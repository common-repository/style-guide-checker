<?php

/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all of the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 * @package           Content_Standards
 * @version           1.3.1
 *
 * @wordpress-plugin
 * Plugin Name:       Style Guide Checker
 * Description:       The Style Guide Checker gives you real-time tips for better content, and highlights text that doesn't follow your personalized content standards.
 * Version:           1.3.1
 * Author:            Editist
 * License:           GPL
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-content-standards-activator.php
 */
function activate_content_standards() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-content-standards-activator.php';
	Content_Standards_Activator::activate();
}

/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-content-standards-deactivator.php
 */
function deactivate_content_standards() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-content-standards-deactivator.php';
	Content_Standards_Deactivator::deactivate();
}

register_activation_hook( __FILE__, 'activate_content_standards' );
register_deactivation_hook( __FILE__, 'deactivate_content_standards' );

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require plugin_dir_path( __FILE__ ) . 'includes/class-content-standards.php';




/**
 * Begins execution of the plugin.
 *
 * Since everything within the plugin is registered via hooks,
 * then kicking off the plugin from this point in the file does
 * not affect the page life cycle.
 *
 * @since    1.0.0
 */
function run_content_standards() {

	$plugin = new Content_Standards( plugin_basename( __FILE__ ) );
	$plugin->run();

}
run_content_standards();
