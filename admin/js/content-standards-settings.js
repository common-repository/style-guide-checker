/*jslint white:true, browser:true, nomen:true, regexp:true */
/*global _, jQuery */

( function( $ ) {

    'use strict';

    // Set up tabbed settings interface
    var $form = $( '.content-standards-options form' );

    // Move all headings under form, to use as tabs
    $form.find( '> h2, > h3' ).addClass( 'tab' ).prependTo( $form ).each( function( i, el ) {
        $( el ).on( 'click select', function() {
            $( this ).addClass( 'selected' ).siblings( '.tab' ).removeClass( 'selected' );
            $form.find( '> .form-table' ).eq( i ).show().siblings( '.form-table' ).hide();
            $form.find( '> .intro' ).eq( i ).show().siblings( '.intro' ).hide();
        } );
    } );

    $form.find( '> .tab' ).eq( 0 ).trigger( 'select' );


    // Validation of "preferred words" input
    var $preferred_input = $( '#cs_words_preferred' );

    $preferred_input
        .on( 'blur', function() {
            var values = ( this.value || '' ).trim().split( /[\r\n]+/ ),
                valid = true;

            _.each( values, function( value ) {
                if ( value.length && !value.match( /^[^=]+=[^=]+$/ ) ) {
                    valid = false;
                }
            } );

            $preferred_input.toggleClass( 'input-error', !valid );
        } )
        .on( 'focus', function() {
            $preferred_input.removeClass( 'input-error' );
        } );

}( jQuery ));
