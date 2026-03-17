import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireProjectOwner } from '../middleware/rbac';
import { PluginLoader } from './PluginLoader';
import { Plugin, PluginStatus } from './types';
import { logger } from '../utils/logger';

export const pluginRoutes = Router();

// Plugin loader instance - will be set by app.ts
let pluginLoader: PluginLoader | null = null;

/**
 * Set the plugin loader instance
 */
export function setPluginLoader(loader: PluginLoader): void {
  pluginLoader = loader;
}

/**
 * Get all plugins
 */
pluginRoutes.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const plugins = pluginLoader.getAllPlugins().map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      author: p.manifest.author,
      status: p.status,
      error: p.error,
    }));

    res.json({
      success: true,
      data: plugins,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get plugins');
    res.status(500).json({
      success: false,
      error: 'Failed to get plugins',
    });
  }
});

/**
 * Get enabled plugins
 */
pluginRoutes.get('/enabled', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const plugins = pluginLoader.getEnabledPlugins().map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      status: p.status,
    }));

    res.json({
      success: true,
      data: plugins,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get enabled plugins');
    res.status(500).json({
      success: false,
      error: 'Failed to get enabled plugins',
    });
  }
});

/**
 * Get single plugin
 */
pluginRoutes.get('/:pluginId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const plugin = pluginLoader.getPlugin(req.params.pluginId);

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author,
        main: plugin.manifest.main,
        dependencies: plugin.manifest.dependencies,
        configSchema: plugin.manifest.configSchema,
        status: plugin.status,
        error: plugin.error,
        config: plugin.config,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get plugin');
    res.status(500).json({
      success: false,
      error: 'Failed to get plugin',
    });
  }
});

/**
 * Enable a plugin
 */
pluginRoutes.post('/:pluginId/enable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const result = await pluginLoader.enablePlugin(req.params.pluginId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        id: result.plugin!.manifest.id,
        status: result.plugin!.status,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to enable plugin');
    res.status(500).json({
      success: false,
      error: 'Failed to enable plugin',
    });
  }
});

/**
 * Disable a plugin
 */
pluginRoutes.post('/:pluginId/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const result = await pluginLoader.disablePlugin(req.params.pluginId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        id: result.plugin!.manifest.id,
        status: result.plugin!.status,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to disable plugin');
    res.status(500).json({
      success: false,
      error: 'Failed to disable plugin',
    });
  }
});

/**
 * Reload a plugin (hot reload)
 */
pluginRoutes.post('/:pluginId/reload', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const result = await pluginLoader.reloadPlugin(req.params.pluginId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        id: result.plugin!.manifest.id,
        status: result.plugin!.status,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to reload plugin');
    res.status(500).json({
      success: false,
      error: 'Failed to reload plugin',
    });
  }
});

/**
 * Uninstall a plugin
 */
pluginRoutes.delete('/:pluginId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const result = await pluginLoader.unloadPlugin(req.params.pluginId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Plugin uninstalled',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to uninstall plugin');
    res.status(500).json({
      success: false,
      error: 'Failed to uninstall plugin',
    });
  }
});

/**
 * Get plugin configuration
 */
pluginRoutes.get('/:pluginId/config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const plugin = pluginLoader.getPlugin(req.params.pluginId);

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    res.json({
      success: true,
      data: {
        config: plugin.config || {},
        schema: plugin.manifest.configSchema || {},
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get plugin config');
    res.status(500).json({
      success: false,
      error: 'Failed to get plugin config',
    });
  }
});

/**
 * Update plugin configuration
 */
pluginRoutes.patch('/:pluginId/config', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!pluginLoader) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not initialized',
      });
    }

    const plugin = pluginLoader.getPlugin(req.params.pluginId);

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    // Merge new config with existing
    plugin.config = {
      ...plugin.config,
      ...req.body,
    };

    res.json({
      success: true,
      data: plugin.config,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update plugin config');
    res.status(500).json({
      success: false,
      error: 'Failed to update plugin config',
    });
  }
});