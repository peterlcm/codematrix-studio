import * as fs from 'fs';
import * as path from 'path';
import {
  Plugin,
  PluginManifest,
  PluginStatus,
  PluginLoaderOptions,
  LoadResult,
  ToggleResult,
} from './types';
import { logger } from '../utils/logger';
import { prisma } from '../database/db';
import { Express } from 'express';

/**
 * Plugin loader - handles dynamic loading and management of plugins
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private options: PluginLoaderOptions;
  private app: Express | null = null;
  private fileWatcher: fs.FSWatcher | null = null;

  constructor(options: PluginLoaderOptions) {
    this.options = {
      autoEnable: true,
      watchForChanges: false,
      ...options,
    };
  }

  /**
   * Initialize the plugin loader
   */
  async initialize(app: Express): Promise<void> {
    this.app = app;

    // Ensure plugins directory exists
    if (!fs.existsSync(this.options.pluginsDir)) {
      fs.mkdirSync(this.options.pluginsDir, { recursive: true });
      logger.info({ pluginsDir: this.options.pluginsDir }, 'Created plugins directory');
      return;
    }

    // Load all plugins from directory
    await this.loadAll();

    // Setup file watcher if enabled
    if (this.options.watchForChanges) {
      this.setupWatcher();
    }

    logger.info({ pluginCount: this.plugins.size }, 'Plugin loader initialized');
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadAll(): Promise<void> {
    const entries = fs.readdirSync(this.options.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.options.pluginsDir, entry.name);
        await this.loadPlugin(pluginPath);
      }
    }
  }

  /**
   * Load a single plugin from a given path
   */
  async loadPlugin(pluginPath: string): Promise<LoadResult> {
    const manifestPath = path.join(pluginPath, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: 'plugin.json not found' };
    }

    try {
      // Read and parse manifest
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.main) {
        return { success: false, error: 'Invalid manifest: missing required fields' };
      }

      // Check if already loaded
      if (this.plugins.has(manifest.id)) {
        return { success: false, error: 'Plugin already loaded' };
      }

      // Create plugin instance
      const plugin: Plugin = {
        manifest,
        status: PluginStatus.LOADING,
      };

      this.plugins.set(manifest.id, plugin);

      // Load the main module
      const mainPath = path.join(pluginPath, manifest.main);
      if (!fs.existsSync(mainPath)) {
        plugin.status = PluginStatus.ERROR;
        plugin.error = `Main file not found: ${manifest.main}`;
        return { success: false, error: plugin.error };
      }

      // Clear require cache for hot reload
      const cached = require.cache[require.resolve(mainPath)];
      if (cached) {
        delete require.cache[require.resolve(mainPath)];
      }

      // Load the module
      const module = require(mainPath);
      const lifecycle = module as any;

      plugin.instance = lifecycle;
      plugin.status = PluginStatus.LOADED;

      logger.info({ pluginId: manifest.id, name: manifest.name }, 'Plugin loaded');

      // Auto-enable if configured
      if (this.options.autoEnable) {
        return await this.enablePlugin(manifest.id);
      }

      return { success: true, plugin };
    } catch (error: any) {
      logger.error({ error, pluginPath }, 'Failed to load plugin');
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable a loaded plugin
   */
  async enablePlugin(pluginId: string): Promise<ToggleResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }

    if (plugin.status === PluginStatus.ENABLED) {
      return { success: true, plugin };
    }

    try {
      plugin.status = PluginStatus.LOADING;

      // Call onEnable lifecycle hook
      if (plugin.instance?.onEnable) {
        const api = this.createPluginAPI(plugin);
        await plugin.instance.onEnable(api);
      }

      // Register routes
      if (plugin.instance?.router) {
        this.registerPluginRoutes(plugin);
      }

      // Save to database for persistence
      await this.savePluginState(pluginId, true);

      plugin.status = PluginStatus.ENABLED;
      logger.info({ pluginId }, 'Plugin enabled');

      return { success: true, plugin };
    } catch (error: any) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = error.message;
      logger.error({ error, pluginId }, 'Failed to enable plugin');
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<ToggleResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }

    if (plugin.status === PluginStatus.DISABLED) {
      return { success: true, plugin };
    }

    try {
      // Call onDisable lifecycle hook
      if (plugin.instance?.onDisable) {
        const api = this.createPluginAPI(plugin);
        await plugin.instance.onDisable(api);
      }

      // Unregister routes
      this.unregisterPluginRoutes(plugin);

      // Save to database for persistence
      await this.savePluginState(pluginId, false);

      plugin.status = PluginStatus.DISABLED;
      logger.info({ pluginId }, 'Plugin disabled');

      return { success: true, plugin };
    } catch (error: any) {
      logger.error({ error, pluginId }, 'Failed to disable plugin');
      return { success: false, error: error.message };
    }
  }

  /**
   * Reload a plugin (hot reload)
   */
  async reloadPlugin(pluginId: string): Promise<LoadResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }

    const pluginPath = path.join(this.options.pluginsDir, pluginId);

    // Disable first
    if (plugin.status === PluginStatus.ENABLED) {
      await this.disablePlugin(pluginId);
    }

    // Unload
    await this.unloadPlugin(pluginId);

    // Re-load
    return await this.loadPlugin(pluginPath);
  }

  /**
   * Unload a plugin completely
   */
  async unloadPlugin(pluginId: string): Promise<ToggleResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }

    try {
      // Call onUnload lifecycle hook
      if (plugin.instance?.onUnload) {
        const api = this.createPluginAPI(plugin);
        await plugin.instance.onUnload(api);
      }

      // Unregister routes
      this.unregisterPluginRoutes(plugin);

      // Remove from map
      this.plugins.delete(pluginId);

      // Remove from database
      await prisma.plugin.deleteMany({
        where: { pluginId },
      });

      logger.info({ pluginId }, 'Plugin unloaded');

      return { success: true };
    } catch (error: any) {
      logger.error({ error, pluginId }, 'Failed to unload plugin');
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      p => p.status === PluginStatus.ENABLED
    );
  }

  /**
   * Create plugin API instance
   */
  private createPluginAPI(plugin: Plugin): any {
    return {
      pluginId: plugin.manifest.id,
      version: plugin.manifest.version,
      router: new PluginRouter(plugin.manifest.id),
      events: new EventEmitter(),
      storage: new PluginStorage(plugin.manifest.id),
      config: new PluginConfig(plugin.manifest.id, plugin.manifest.configSchema || {}),
      logger: new PluginLogger(plugin.manifest.id),
    };
  }

  /**
   * Register plugin routes to Express app
   */
  private registerPluginRoutes(plugin: Plugin): void {
    if (!this.app || !plugin.instance?.router) return;

    const pluginRouter = (plugin.instance.router as any).getRouter?.();
    if (pluginRouter) {
      this.app.use(`/api/v1/plugins/${plugin.manifest.id}`, pluginRouter);
    }
  }

  /**
   * Unregister plugin routes
   */
  private unregisterPluginRoutes(_plugin: Plugin): void {
    // Routes will be cleared when the app restarts or we can implement route tracking
  }

  /**
   * Save plugin state to database
   */
  private async savePluginState(pluginId: string, enabled: boolean): Promise<void> {
    await prisma.plugin.upsert({
      where: { pluginId },
      update: { enabled },
      create: { pluginId, enabled },
    });
  }

  /**
   * Setup file watcher for hot reload
   */
  private setupWatcher(): void {
    this.fileWatcher = fs.watch(this.options.pluginsDir, async (eventType, filename) => {
      if (eventType === 'change' && filename) {
        logger.info({ eventType, filename }, 'Plugin file changed, triggering reload');
        // Debounce and reload
        setTimeout(async () => {
          await this.reloadPlugin(filename);
        }, 500);
      }
    });
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    // Disable all enabled plugins
    for (const plugin of this.getEnabledPlugins()) {
      await this.disablePlugin(plugin.manifest.id);
    }

    // Close file watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    logger.info('Plugin loader shutdown');
  }
}

/**
 * Simple router implementation for plugins
 */
class PluginRouter {
  private routes: Map<string, Map<string, any>> = new Map();
  private middleware: any[] = [];
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  get(path: string, handler: any): void {
    this.addRoute('get', path, handler);
  }

  post(path: string, handler: any): void {
    this.addRoute('post', path, handler);
  }

  put(path: string, handler: any): void {
    this.addRoute('put', path, handler);
  }

  patch(path: string, handler: any): void {
    this.addRoute('patch', path, handler);
  }

  delete(path: string, handler: any): void {
    this.addRoute('delete', path, handler);
  }

  use(handlerOrPath: string | any, handler?: any): void {
    if (typeof handlerOrPath === 'function') {
      this.middleware.push(handlerOrPath);
    } else if (handler) {
      // Path-specific middleware
      this.middleware.push({ path: handlerOrPath, handler });
    }
  }

  private addRoute(method: string, path: string, handler: any): void {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  getRouter(): any {
    // Return a simple Express router-like object
    return {
      get: (path: string, handler: any) => this.get(path, handler),
      post: (path: string, handler: any) => this.post(path, handler),
      put: (path: string, handler: any) => this.put(path, handler),
      patch: (path: string, handler: any) => this.patch(path, handler),
      delete: (path: string, handler: any) => this.delete(path, handler),
      use: (path: any, handler?: any) => this.use(path, handler),
    };
  }
}

/**
 * Event emitter implementation
 */
class EventEmitter {
  private handlers: Map<string, Set<Function>> = new Map();

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, data?: any): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error({ error, event }, 'Event handler error');
      }
    });
  }

  once(event: string, handler: Function): void {
    const onceHandler = (data: any) => {
      handler(data);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }
}

/**
 * Plugin storage implementation
 */
class PluginStorage {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  async get(key: string): Promise<any> {
    const record = await prisma.pluginStorage.findUnique({
      where: { pluginId_key: { pluginId: this.pluginId, key } },
    });
    return record?.value;
  }

  async set(key: string, value: any): Promise<void> {
    await prisma.pluginStorage.upsert({
      where: { pluginId_key: { pluginId: this.pluginId, key } },
      update: { value: JSON.stringify(value) },
      create: { pluginId: this.pluginId, key, value: JSON.stringify(value) },
    });
  }

  async delete(key: string): Promise<void> {
    await prisma.pluginStorage.deleteMany({
      where: { pluginId: this.pluginId, key },
    });
  }

  async clear(): Promise<void> {
    await prisma.pluginStorage.deleteMany({
      where: { pluginId: this.pluginId },
    });
  }

  async getAll(): Promise<Record<string, any>> {
    const records = await prisma.pluginStorage.findMany({
      where: { pluginId: this.pluginId },
    });
    return records.reduce((acc, r) => {
      acc[r.key] = JSON.parse(r.value);
      return acc;
    }, {} as Record<string, any>);
  }
}

/**
 * Plugin configuration
 */
class PluginConfig {
  private config: Record<string, any>;
  private schema: Record<string, any>;

  constructor(pluginId: string, schema: Record<string, any>) {
    this.schema = schema;
    this.config = {};
    // Load from database would go here
  }

  get(key: string): any {
    return this.config[key];
  }

  set(key: string, value: any): void {
    this.config[key] = value;
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }

  async save(): Promise<void> {
    // Save to database
  }
}

/**
 * Plugin logger
 */
class PluginLogger {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  info(message: string, meta?: any): void {
    logger.info({ pluginId: this.pluginId, ...meta }, message);
  }

  warn(message: string, meta?: any): void {
    logger.warn({ pluginId: this.pluginId, ...meta }, message);
  }

  error(message: string, meta?: any): void {
    logger.error({ pluginId: this.pluginId, ...meta }, message);
  }

  debug(message: string, meta?: any): void {
    logger.debug({ pluginId: this.pluginId, ...meta }, message);
  }
}