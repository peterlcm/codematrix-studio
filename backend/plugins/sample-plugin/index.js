/**
 * Sample Plugin for CodeMatrix Studio
 *
 * This demonstrates the plugin lifecycle and API usage.
 */

// Lifecycle hooks
module.exports = {
  /**
   * Called when the plugin is loaded
   */
  onLoad: async function(api) {
    api.logger.info('Sample plugin loaded', { pluginId: api.pluginId });
    api.events.on('project:created', (data) => {
      api.logger.info('Project created event received', data);
    });
  },

  /**
   * Called when the plugin is enabled
   */
  onEnable: async function(api) {
    api.logger.info('Sample plugin enabled');

    // Register routes
    api.router.get('/hello', (req, res) => {
      const greeting = api.config.get('greeting') || 'Hello';
      res.json({
        message: `${greeting}, World!`,
        plugin: api.pluginId,
        version: api.version,
      });
    });

    api.router.get('/config', (req, res) => {
      res.json(api.config.getAll());
    });

    api.router.post('/echo', (req, res) => {
      res.json({
        echoed: req.body,
        timestamp: new Date().toISOString(),
      });
    });

    api.logger.info('Routes registered');
  },

  /**
   * Called when the plugin is disabled
   */
  onDisable: async function(api) {
    api.logger.info('Sample plugin disabled');
  },

  /**
   * Called when the plugin is unloaded
   */
  onUnload: async function(api) {
    api.logger.info('Sample plugin unloaded');
  },
};