import { Request, Response, NextFunction } from 'express';

/**
 * Plugin manifest definition
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  dependencies?: Record<string, string>;
  configSchema?: Record<string, any>;
}

/**
 * Plugin lifecycle states
 */
export enum PluginStatus {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
}

/**
 * Plugin instance interface
 */
export interface Plugin {
  manifest: PluginManifest;
  status: PluginStatus;
  instance?: any;
  config?: Record<string, any>;
  error?: string;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  onLoad?: (api: PluginAPI) => Promise<void> | void;
  onEnable?: (api: PluginAPI) => Promise<void> | void;
  onDisable?: (api: PluginAPI) => Promise<void> | void;
  onUnload?: (api: PluginAPI) => Promise<void> | void;
}

/**
 * Extension API exposed to plugins
 */
export interface PluginAPI {
  // Plugin info
  pluginId: string;
  version: string;

  // Express integration
  router: ExpressRouter;
  registerRoute(method: string, path: string, handler: RouteHandler): void;
  registerMiddleware(middleware: ExpressMiddleware): void;

  // Events
  events: EventEmitter;

  // Storage
  storage: PluginStorage;

  // Config
  config: PluginConfig;

  // Logger
  logger: PluginLogger;
}

/**
 * Express router for plugins
 */
export interface ExpressRouter {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  patch(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  use(path: string, handler: RouteHandler): void;
  use(handler: RouteHandler): void;
}

/**
 * Route handler function
 */
export type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Express middleware
 */
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Event emitter for plugin communication
 */
export interface EventEmitter {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data?: any): void;
  once(event: string, handler: EventHandler): void;
}

/**
 * Event handler function
 */
export type EventHandler = (data?: any) => void | Promise<void>;

/**
 * Plugin storage interface
 */
export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getAll(): Promise<Record<string, any>>;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  get(key: string): any;
  set(key: string, value: any): void;
  getAll(): Record<string, any>;
  save(): Promise<void>;
}

/**
 * Plugin logger
 */
export interface PluginLogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
  pluginsDir: string;
  autoEnable?: boolean;
  watchForChanges?: boolean;
}

/**
 * Load result
 */
export interface LoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}

/**
 * Enable/Disable result
 */
export interface ToggleResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}