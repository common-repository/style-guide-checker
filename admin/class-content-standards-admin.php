<?php

/**
 * The admin-specific functionality of the plugin.
 *
 * @since      1.0.0
 *
 * @package    Content_Standards
 * @subpackage Content_Standards/admin
 */

/**
 * The admin-specific functionality of the plugin.
 *
 * Defines the plugin name, version, and two examples hooks for how to
 * enqueue the admin-specific stylesheet and JavaScript.
 *
 * @package    Content_Standards
 * @subpackage Content_Standards/admin
 * @author     Editist <info@editist.com>
 */
class Content_Standards_Admin {

	/**
	 * The ID of this plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $plugin_name    The ID of this plugin.
	 */
	private $plugin_name;

	/**
	 * The version of this plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $version    The current version of this plugin.
	 */
	private $version;

	/**
	 * The content checks definitions.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      object    $checks    The content checks definitions.
	 */
	private $checks;

	/**
	 * The display name of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $checks    The display name of the plugin.
	 */
    private $plugin_display_name = 'Style Guide';

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 * @param      string    $plugin_name       The name of this plugin.
	 * @param      string    $version    The version of this plugin.
	 */
	public function __construct( $plugin_name, $version ) {

		$this->plugin_name = $plugin_name;
		$this->version = $version;
        $this->parse_checks_config();
	}

	/**
	 * Parse the checks data from JSON definition file.
	 *
	 * @since    1.0.0
	 */
	private function parse_checks_config() {

    	$json = file_get_contents( plugin_dir_path( __FILE__ ) . 'checks/checks.json' );
        $this->checks = json_decode( $json );

	}

	/**
	 * Register the stylesheets for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function enqueue_styles() {

		wp_enqueue_style( $this->plugin_name, plugin_dir_url( __FILE__ ) . 'css/content-standards-admin.css', array(), $this->version, 'all' );
		wp_enqueue_style( $this->plugin_name . 'common', plugin_dir_url( __FILE__ ) . 'css/content-standards-common.css', array(), $this->version, 'all' );

        add_editor_style( plugin_dir_url( __FILE__ ) . 'css/content-standards-editor.css' );
        add_editor_style( plugin_dir_url( __FILE__ ) . 'css/content-standards-common.css' );
        
        // Gutenberg support
        function gutenbergtheme_editor_styles() { 
            wp_enqueue_style( 'gutenbergthemeblocks-style', plugin_dir_url( __FILE__ ) . 'css/content-standards-editor.css' );
        }

        add_action( 'enqueue_block_editor_assets', 'gutenbergtheme_editor_styles' );
	}

	/**
	 * Register the JavaScript for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function enqueue_scripts( $page ) {
        
        wp_enqueue_script( 'jquery-ui-draggable' );
        wp_enqueue_script( 'jquery-ui-resizable' );
        wp_enqueue_script( $this->plugin_name . 'find',  plugin_dir_url( __FILE__ ) . 'js/findAndReplaceDOMText.js', array(), $this->version, false );
        wp_enqueue_script( $this->plugin_name,  plugin_dir_url( __FILE__ ) . 'js/content-standards.js', array( 'jquery', 'underscore' ), $this->version, false );

        if ( $page == 'toplevel_page_define-content-standards' ) {
            wp_enqueue_script( $this->plugin_name . 'settings',  plugin_dir_url( __FILE__ ) . 'js/content-standards-settings.js', array( 'jquery', 'underscore' ), $this->version, true );
        }
	}

	/**
	 * Add settings page for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function add_admin_menu() {

        add_menu_page(
            'Define Your ' . $this->plugin_display_name,
            $this->plugin_display_name,
            'manage_options',
            'define-content-standards',
            array( $this, 'create_admin_page' ),
            'dashicons-edit',
            75
        );

	}

	/**
	 * Define settings options for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function setup_settings() {

    	@settings_errors();

        // add settings sections
        $this->add_settings_section( 'content_section_preferences', 'Your style guide', 'Define content standards for your team.' );
        $this->add_settings_section( 'content_section_goodwriting', 'General writing rules', 'Check your writing against general writing rules and best practices. Turn off checks you don\'t want.' );
        $this->add_settings_section( 'content_section_settings',    'Settings', 'Configure the settings for the Style Guide plugin.' );

        // register settings
        foreach( $this->checks as $id => $check ) {

            register_setting( 'content_group', $id );

            $input = $check->input;

            if ( strpos( $input, ',' ) !== false ) {
                $input = 'choose';
            }

            add_settings_field(
                $id,
                $check->title,
                array( $this, 'settings_field_input_' . $input ),
                'define-content-standards',
                $check->group,
                array(
                    'field' => $id,
                    'placeholder' => ( isset( $check->placeholder ) ? $check->placeholder : null ),
                    'desc' => ( isset( $check->desc ) ? $check->desc : null ),
                    'inputoptions' => ( isset( $check->inputoptions ) ? $check->inputoptions : null ),
                    'default' => ( isset( $check->default ) ? $check->default : null )
                )
            );

        }

	}

	private function add_settings_section( $id, $title, $intro ) {

    	add_settings_section(
            $id,
            $title,
            function() use ( $intro ) {
                echo '<p class="intro">' . $intro . '</p>';
            },
            'define-content-standards'
        );
	}

	public function settings_field_input_textarea( $args ) {

        $field = $args[ 'field' ];
        $value = get_option( $field, $args[ 'default' ] );
        $placeholder = $args[ 'placeholder' ];

        echo sprintf( '<textarea rows="5" name="%s" id="%s" placeholder="%s">%s</textarea>', $field, $field, $placeholder, $value );

        if ( $args[ 'desc' ] ) {
            echo sprintf( '<p class="description">%s</p>', $args[ 'desc' ] );
        }

    }

    public function settings_field_input_onoff( $args ) {

        $field = $args[ 'field' ];
        $desc  = $args[ 'desc' ];
        $value = get_option( $field, $args[ 'default' ] );

        echo sprintf( '<label for="%s"><input type="checkbox" name="%s" id="%s" value="1" ' . checked( $value, 1, false ) . '> %s</label>', $field, $field, $field, $desc );
    }

    public function settings_field_input_choose( $args ) {

        $field = $args[ 'field' ];
        $desc  = $args[ 'desc' ];
        $value = get_option( $field, $args[ 'default' ] );
        $options = $args[ 'inputoptions' ];

        echo '<div class="radiogroup">';

        foreach ( $options as $val => $label ) {
            $fieldid = $field . $val;
            echo sprintf( '<label for="%s"><input type="radio" name="%s" id="%s" value="%s" ' . checked( $value, $val, false ) . '>%s</label> ', $fieldid, $field, $fieldid, $val, $label );
        }

        if ( $args[ 'desc' ] ) {
            echo sprintf( '<p class="description">%s</p>', $args[ 'desc' ] );
        }

        echo '</div>';
    }

    public function settings_field_input_roles( $args ) {

        global $wp_roles;

        if ( !isset( $wp_roles ) ) {
            $wp_roles = new WP_Roles();
        }

        $roles = $wp_roles->get_names();
        $inputoptions = array();

        foreach( $roles as $role_value => $role_name ) {
            $inputoptions[ $role_value ] = $role_name;
        }

        $args[ 'inputoptions' ] = $inputoptions;
        $args[ 'default' ] = array_keys( $inputoptions );

        $this->settings_field_input_checkbox( $args );
    }

    public function settings_field_input_checkbox( $args ) {

        $field = $args[ 'field' ];
        $desc  = $args[ 'desc' ];
        $value = get_option( $field, $args[ 'default' ] );
        $options = $args[ 'inputoptions' ];

        if ( !is_array( $value ) ) {
            $value = array( $value );
        }

        echo '<div class="checkboxgroup">';

        foreach ( $options as $val => $label ) {
            $fieldid = $field . $val;
            echo sprintf( '<label for="%s"><input type="checkbox" name="%s[]" id="%s" value="%s" ' . checked( in_array( $val, $value ), true, false ) . '>%s</label> ', $fieldid, $field, $fieldid, $val, $label );
        }

        if ( $args[ 'desc' ] ) {
            echo sprintf( '<p class="description">%s</p>', $args[ 'desc' ] );
        }

        echo '</div>';
    }

    public function settings_field_input_wysiwyg( $args ) {

        $field = $args[ 'field' ];
        $value = get_option( $field, $args[ 'default' ] );

        $settings = array(
            'teeny' => true,
            'textarea_rows' => 10,
            'editor_height' => 230,
            'wpautop' => false
            // 'tabindex' => 1
        );

        wp_editor( $value, $field, $settings );

        if ( $args[ 'desc' ] ) {
            echo sprintf( '<p class="description">%s</p>', $args[ 'desc' ] );
        }
    }

	public function create_admin_page() {
        ?>
        <div class="wrap content-standards-options">
            <h2><?php echo $this->plugin_display_name; ?></h2>
            <form method="post" action="options.php">
            <?php
                settings_fields( 'content_group' );
                do_settings_sections( 'define-content-standards' );
            ?>
            <p class="content-standards-settings-actions">
                <?php
                    submit_button( 'Save Settings', 'primary', 'submit', false );

                    echo '<a class="content-standards-settings-upgrade content-standards-upgrade" href="https://editist.com/#upgrade" target="_blank">Upgrade to Premium for more rules, settings, and support.</a>';

                ?>
            </p>
            </form>
        </div>
        <?php
    }

    public function add_custom_meta_box() {

        $valid_roles = get_option( 'cs_enabled_roles' );
        $user_roles = wp_get_current_user()->roles;

        if ( isset( $valid_roles ) &&
             is_array( $valid_roles ) &&
             count( $valid_roles ) > 0 &&
             count( array_intersect( $valid_roles, $user_roles ) ) === 0 ) {

            return false;
        }

        $editor_post_types = array();

        foreach ( get_post_types() as $post_type ) {
            if ( post_type_supports( $post_type, 'editor' ) ) {
                $editor_post_types[] = $post_type;
            }
        }

		$screenIds = $editor_post_types;
		$version = get_bloginfo( 'version' );

		if ( version_compare( $version, '4.4.0' ) < 0 ) {
			$screen = get_current_screen();

			if ( in_array( $screen->post_type, $editor_post_types ) ) {
				$screenIds = null; // defaults to displaying on current screen
			}
			else {
				$screenIds = false; // don't display
			}
		}
		
		$gutenberg_compatible = !get_option( 'cs_setting_gutenberg_disable' );

        add_meta_box(
            'content-standards-meta-box',
            $this->plugin_display_name,
            array( $this, 'content_standards_meta_box' ),
            $screenIds,
            'side',
            'high',
            array(
                '__block_editor_compatible_meta_box' => $gutenberg_compatible,
            )
        );

    }

    public function content_standards_meta_box() {

        add_thickbox();
        ?>
        <div id="content-standards-meta-feedback"></div>

        <div id="content-standards-meta-checkbox">
            <label for="content-standards-checkbox">
                Highlight issues when I stop typing
                <input type="checkbox" id="content-standards-checkbox" name="content-standards-checkbox" value="on" checked="checked" />
            </label>
        </div>

        <div id="content-standards-meta-styleguide">

            <div id="content-standards-meta-styleguide-modal" class="modal-container" style="display: none;">

                <div class="modal-dialog">
                    <div class="modal-header">
                        <h1><?php printf( '%s: Style Guide', get_bloginfo( 'name' ) ); ?></h1>
                        <a href="#" class="btn-close" aria-hidden="true">×</a>
                    </div>

                    <div class="modal-body">
                    <?php

                        $intro = get_option( 'cs_setting_guide_intro' );

                        if ( $intro && strlen( $intro ) ) {
                            echo '<div class="introduction">' . $intro . '</div>';
                        }

                        foreach ( $this->checks as $id => $check ) {

                            $uservalue = get_option( $id, isset( $check->default ) ? $check->default : null  );
                            $desc = $check->desc;
                            $styleguide = ( isset( $check->styleguide ) ? $check->styleguide : null );
                            $listuservalues = ( $styleguide && isset( $check->styleguide->listuservalues ) ? $check->styleguide->listuservalues : null );

                            // User has switched off
                            if ( $check->input == 'onoff' && $uservalue == 0 || $check->input == 'choose' && $uservalue == 'off' || $styleguide === false || $listuservalues && !$uservalue ) {
                                continue;
                            }

                            if ( $check->input == 'choose' && $styleguide && $check->styleguide->desc && isset( $check->styleguide->desc->$uservalue ) ) {
                                $desc = $check->styleguide->desc->$uservalue;
                            }
                            else if ( $styleguide && is_string( $check->styleguide->desc ) ) {
                                $desc = $check->styleguide->desc;
                            }
                            else if ( $styleguide && is_object( $check->styleguide->desc ) ) {
                                $desc = '';
                            }

                            print( '<div class="section">' );
                            printf( '<h2>%s</h2>', $check->title );
                            printf( '<p>%s</p>', $desc );

                            if ( $styleguide && $listuservalues ) {

                                if ( $check->input == 'choose' ) {
                                    $uservalue = $check->inputoptions->$uservalue;
                                }

                                if ( $check->test->type == 'preferred' ) {
                                    $uservalue = str_replace( ',', ', ', $uservalue );
                                    $uservalue = preg_replace('/^([^=]+)=/m', '<span class="pref">$1</span>', $uservalue );
                                }

                                print( '<ul class="termlist">' );
                                print( '<li>' . implode( '</li><li>', preg_split( '/\R+/', $uservalue ) ) . '</li>' );
                                print( '</ul>' );
                            }

                            if ( $check->test->type == 'optionalregexp' && $uservalue && is_object( $check->styleguide->desc ) ) {

                                if ( !is_array( $uservalue ) ) {
                                    $uservalue = array( $uservalue );
                                }

                                print( '<ul class="termlist">' );

                                foreach( $uservalue as $value ) {
                                    print( '<li>' . $check->styleguide->desc->$value . '</li>' );
                                }

                                print( '</ul>' );
                            }

                            print( '</div>' );
                        }
                    ?>

                        <div class="close"><a href="#" class="button btn-close">Close the style guide</a></div>
                        <p>&#160;</p>
                    </div>
                </div>

            </div>

            <div id="content-standards-meta-styleguide-button-container">
                <?php

                    echo '<div class="content-standards-meta-upgrade-container"><a class="content-standards-meta-upgrade content-standards-upgrade" href="https://editist.com/#upgrade" target="_blank">Upgrade</a></div>';

                ?>
                <a href="#" class="toggle-popout-style button"><span class="dashicons dashicons-external"></span><span class="popout-name"></span></a>
                <a href="#" class="open-style-guide button">Open the style guide</a>
            </div>

        </div>
        <?php
    }


    public function content_standards_get_checks() {

        $return = array();
        $wordlist_types = array( 'capitalized', 'preferred', 'blacklist' );
        $wordlist_keyed = array( 'preferred' );

        foreach ( $this->checks as $id => $check ) {

            $uservalue = get_option( $id, $check->default );

            // User has switched off
            if ( $check->input == 'onoff' && $uservalue == 0 || $check->input == 'choose' && $uservalue == 'off' ) {
                continue;
            }

            // Allow different 'tests' depending on user chosen option
            if ( $check->input == 'choose' && is_string( $uservalue ) && $check->test && array_key_exists( $uservalue, $check->test ) ) {
                foreach( $check->test->$uservalue as $key => $value ) {
                    $check->test->$key = $value;
                }
                unset( $check->test->$uservalue );
            }

            if ( $check->test->type == 'optionalregexp' ) {

                if ( !$uservalue ) {
                    continue;
                }
                else if ( !is_array( $uservalue ) ) {
                    $uservalue = array( $uservalue );
                }

                $regexps = array();

                foreach( $uservalue as $regexptype ) {
                    $regexps[ $regexptype ] = $check->test->regexp->$regexptype;
                }

                $check->test->regexp = $regexps;
            }

            // Format wordlists
            if ( in_array( $check->test->type, $wordlist_types ) && !$check->test->wordlist ) {

                if ( !( $uservalue && strlen( $uservalue ) ) ) {
                    continue; // User hasn't entered any words
                }

                $uservalue = array_filter( preg_split( '/\R+/', $uservalue ) );

                if ( in_array( $check->test->type, $wordlist_keyed ) ) {

                    // Split A=X,Y,Z into hashed array of [ A : '(X|Y|Z)' ]
                    $newuservalue = array();

                    foreach( $uservalue as $line ) {

                        list( $key, $linevals ) = preg_split( '/\s*=\s*/', $line, 2 );

                        if ( !( $key && $linevals && strlen( $key ) && strlen( $linevals ) ) ) {
                            continue;
                        }

                        $linevals = array_filter( preg_split( '/\s*,\s*/', trim( $linevals ) ) );

                        if ( !count( $linevals ) ) {
                            continue;
                        }

                        $newuservalue[ trim( $key ) ] = '(' . join( '|', array_map( 'preg_quote', $linevals ) )  . ')';
                    }

                    $uservalue = $newuservalue;
                }

                $check->test->wordlist = $uservalue;

            }
            else {
                $check->value = $uservalue;
            }

            $return[ $id ] = $check;
        }

        wp_send_json( $return );
    }

    public function content_standards_get_user_option() {

        $option = $_GET[ 'option' ];

        $return = array();
        $return[ $option ] = get_user_option( $option );

        wp_send_json( $return );
    }

    public function content_standards_set_user_option() {

        $disableInlineHighlight = $_POST[ 'disableInlineHighlight' ];
        $userId = get_current_user_id();

        update_user_option( $userId, 'disableInlineHighlight', $disableInlineHighlight );

        wp_send_json_success();
    }

    public function remove_duplicate_content( $content ) {

        if ( $content && strlen( $content ) ) {
            $content = preg_replace( '/<div id=\\\?"cs--duplicate-content.*§§cs§§\s*<\/div>/s', '', $content );
        }

        return $content;
    }


    public function content_standards_action_links( $links ) {

        $csLinks = array();
        $csLinks[ 'settings' ] = '<a href="' . admin_url( 'admin.php?page=define-content-standards' ) . '">Edit Style Guide</a>';
        $csLinks[ 'upgrade' ]  = '<a href="https://editist.com/#upgrade" target="_blank">Upgrade</a>';

        return array_merge( $links, $csLinks );
    }

}
