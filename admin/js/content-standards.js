/*jslint white:true, browser:true, nomen:true, regexp:true */
/*global _, jQuery, ajaxurl, findAndReplaceDOMText */

( function( $ ) {

    'use strict';

    // Upgrade old underscore (in old versions of Wordpress)
    if ( typeof _.mapObject === 'undefined' ) {
        _.mapObject = function( object, iteratee ) {

            var result = {};

            Object.keys( object ).forEach( function( key ) {
                result[ key ] = iteratee( object[ key ], key );
            } );

            return result;
        };
    }



    /* *********************************************************************************************************************** */
    var debounceChecks = 2000,
        removeHighlightAfter = 1300,
        wpmReadTime = 180,
        minReadingGrade = 5,
        tinyMceLoaded = false,
        isGutenberg = false,
        warnNoTinyMceDelay = 10000,
        metaBoxContentSelector = '#content-standards-meta-box #content-standards-meta-feedback',
        metaBoxTitleSelector = '#content-standards-meta-box > h2 > span',
        checkboxSelector = '#content-standards-meta-box #content-standards-checkbox',
        monthNames = _.invert( 'janfebmaraprmayjunjulaugsepoctnovdec'.match( /.{3}/g ) ),
        longMonthNames = 'January,February,March,April,May,June,July,August,September,October,November,December'.split( ',' ),
        ignoreElements = 'br,hr,script,style,img,video,audio,canvas,svg,map,object,input,textarea,select,option,optgroup,button'.split( ',' ),
        visuallyInterestingElements = 'img,video,audio,canvas,svg,ul,ol,blockquote,h1,h2,h3,h4,h5,h6';

    function setupStyleGuideModal() {

        var toggleElements = [
            '#content-standards-meta-box .open-style-guide',
            '#content-standards-meta-styleguide-modal',
            '#content-standards-meta-styleguide-modal .btn-close'
        ];

        $( toggleElements.join( ',' ) ).on( 'click', function( event ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            $( '#content-standards-meta-styleguide-modal' ).toggle();
            $( 'body' ).toggleClass( 'content-standards-modal-open' );
        } );

        $( '#content-standards-meta-styleguide-modal .modal-body' ).on( 'click', function( event ) {
            event.stopImmediatePropagation();
        } );
    }
    
    function setupPopOpenToggle() {
        $( '#content-standards-meta-styleguide-button-container .toggle-popout-style' ).on( 'click', function( event ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            var $box = $( '#content-standards-meta-box' ).toggleClass( 'popout-style' );
            
            if ( $box.hasClass( 'popout-style' ) ) {
                $( '<div id="content-standards-meta-box-placeholder"></div>' ).insertAfter( $box );
                $box.appendTo( 'body' );
                $box.draggable( {
                    handle : 'h2'
                } );
                $box.resizable ( {
                    handles : 's'
                } );
                $box.find( 'h2' ).on( 'click.stopCloser', function() {
                    $box.removeClass( 'closed' );
                } );
            }
            else {
                var $placeholder = $( '#content-standards-meta-box-placeholder' );
                $box.insertBefore( $placeholder );
                $box.draggable( 'destroy' );
                $box.resizable( 'destroy' );
                $box.css( {
                    top : '',
                    bottom : '',
                    left : '',
                    right : '',
                    position : '',
                    display : '',
                    height : '',
                    width : ''
                } );
                $box.find( 'h2' ).off( 'click.stopCloser' );
                $placeholder.remove();
            }
        } );
    }

    function getHighlightNode( check, html, matchId ) {
        var highlightNode = document.createElement( 'span' );
        highlightNode.className = 'cs--check ' + ( check.id || '' );
        highlightNode.setAttribute( 'data-id', matchId || '' );
        highlightNode.innerHTML = html;
        return highlightNode;
    }

    function filterElementsDuringMatch( el ) {
        return !_.contains( ignoreElements, ( el.nodeName || '' ).toLowerCase() );
    }


    /* ************************ */

    function ContentStandards() {

        this.checks = null;
        this.$summaryEl = null;
        this.$summaryTitleEl = null;
        this.feedback = [];
        this.duplicateContentEl = null;
        this.editor = null;
        this.disableInlineHighlight = null;
        this.editorHasLoaded = false;

        this.setEditor = function( editor ) {
            this.editor = editor;
        };

        this.getContentEl = function() {
            return this.editor.getBody();
        };

        this.setSummaryElement = function( $el, $titleEl ) {
            this.$summaryEl = $el;
            this.$summaryTitleEl = $titleEl;
            return ( this.$summaryEl && this.$summaryEl.length );
        };

        this.setEditorHasLoaded = function() {
            this.editorHasLoaded = true;
            this.runFirstChecksIfReady();
        };

        this.runFirstChecksIfReady = function() {
            if ( this.editorHasLoaded && ( this.disableInlineHighlight !== null ) ) {
                this.runChecks();
            }
        };

        this.setDisableInlineHighlight = function( bool ) {
            this.disableInlineHighlight = bool;
        };

        this.setupEvents = function() {

            if ( !this.editor ) {
                return;
            }
            
            var Checker = this;
            
            this.debouncedRunChecks = _.debounce( function() {
                Checker.runChecks();
            }, debounceChecks );

            $( window ).on( 'resize', function() {
                Checker.removeDuplicateContent();
                Checker.debouncedRunChecks();
            } );
                        
            this.setupRightColEvents();
            this.setupEditorEvents();

        };
        
        this.setupRightColEvents = function() {
            
            var Checker = this;
            
            
            // --------- "Highlight issues" checkbox ---------
            
            // Get initial checkbox value, run checks if checked, and set up checkbox change event to save
            this.getUserOption( 'disableInlineHighlight', function( value ) {

                value = ( value === undefined ? true : value );

                $( checkboxSelector ).prop( 'checked', !value );

                Checker.setDisableInlineHighlight( value );
                Checker.runFirstChecksIfReady();

            } );

            $( checkboxSelector ).on( 'change', function() {

                var isDisabled = !this.checked;

                Checker.setDisableInlineHighlight( isDisabled );
                Checker.saveUserOption( { disableInlineHighlight : isDisabled } );

                if ( !isDisabled ) {
                    Checker.runChecks();
                }
                else {
                    Checker.removeDuplicateContent();
                }
            } );
            
            
            // --------- Wordpress Buttons: Publish, Save Draft, etc ---------
            var removeDupe = function() {
                    Checker.removeDuplicateContent();
                };
                
            $( 'input#publish, input#save-post, a#post-preview, a.submitdelete, button.switch-html' ).on( 'mousedown click', removeDupe );
            $( '.edit-post-header__settings' ).on( 'mousedown click', 'button', removeDupe ); // gutenberg re-creates buttons so attach delegate to parent 
            
        };
        
        this.setupEditorEvents = function() {
            
            var Checker = this,
                iFrameEl = this.editor.iframeElement, // Check for iFrame loading / initial run
                iFrameDoc = iFrameEl ? iFrameEl.contentDocument || iFrameEl.contentWindow.document : null;
            
            // Tell checker to run first checks once the editor/content is fully loaded
            if ( iFrameEl && iFrameDoc ) { // These don't exist in Gutenberg editor
                if ( iFrameDoc.readyState === 'complete' ) {
                    Checker.setEditorHasLoaded();
                }
                else {
                    iFrameEl.onload = function() {
                        Checker.setEditorHasLoaded();
                    };
                }
            }
            else {
                // Gutenberg is already loaded with rest of page, so run first checks
                Checker.setEditorHasLoaded();
            }

            // Watch a different "top level element" for events depending on if gutenberg or tinymce classic
            var watchTopLevelEl = isGutenberg ? this.editor.bodyElement : this.editor.contentDocument;

            // Set up check/hide events for wysiwyg change and other standard wp/javascript events
            $( watchTopLevelEl ).on( 'input cut paste keyup', function( e ) {

                if ( e.type === 'keyup' && e.keyCode !== 8 ) {
                    return; // only use for delete
                }

                Checker.removeDuplicateContent();
                Checker.debouncedRunChecks();
            } );
            
            // Run checks when nodes change / commands run (e.g. paste, cut)
            this.editor.on( 'NodeChange LoadContent ExecCommand', function( e ) {

                if ( e.type === 'nodechange' && !e.selectionChange ) {
                    return;
                }

                Checker.removeDuplicateContent();
                Checker.debouncedRunChecks();
            } );

            // Use MutationObserver to pick up other plugins dynamically changing width/height (inc via CSS) of elements
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

            if ( MutationObserver ) {

                var myObserver = new MutationObserver( function() {
                        Checker.removeDuplicateContent();
                        Checker.debouncedRunChecks();
                    } );

                myObserver.observe( watchTopLevelEl, {
                    childList : false,
                    characterData : false,
                    subtree : true,
                    attributes : true,
                    attributeFilter : [ 'style', 'width', 'height' ]
                } );
            }

            // Set up a single click handler for clicking on an inline highlight
            $( watchTopLevelEl ).on( 'click.contentstandards', _.debounce( function( e ) {

                if ( !Checker.duplicateContentEl ) {
                    return;
                }

                var x = e.clientX,
                    y = e.clientY;

                Checker.duplicateContentEl.find( '.cs--check' ).filter( function() {
                    var rect = this.getBoundingClientRect();
                    return rect.top <= y && rect.bottom >= y && rect.left <= x && rect.right >= x;
                } ).sort( function( a, b ) {
                    return ( a.offsetHeight * a.offsetWidth <  b.offsetHeight * b.offsetWidth ) ? -1 : 1;
                } ).first().each( function() {

                    var id = this.getAttribute( 'data-id' ),
                        $li = Checker.$summaryEl.find( 'li[data-id="' + id + '"]' );

                    $li.addClass( 'cs--highlight' ).closest( '.box' ).find( '> input.toggle' ).prop( 'checked', true );

                    _.delay( function() {
                        $li.removeClass( 'cs--highlight' );
                    }, removeHighlightAfter );
                } );

            }, 100 ) ); // a short debounce to prevent double click/performance issues
        };

        this.getUserOption = function( option, callback ) {

            $.ajax( {
                type : 'GET',
                url : ajaxurl,
                context : this,
                data : {
                    action : 'content_standards_get_user_option',
                    option : option
                }
            } ).success( function( data ) {
                var value = data[ option ];

                if ( value === 'true' ) {
                    value = true;
                }
                else if ( value === 'false' ) {
                    value = false;
                }
                else if ( value === 'null' ) {
                    value = undefined;
                }

                callback( value );
            } );

        };

        this.saveUserOption = function( options ) {

            $.ajax( {
                type : 'POST',
                url : ajaxurl,
                context : this,
                data : _.extend( options, {
                    action : 'content_standards_set_user_option'
                } )
            } );

        };

        this.loadChecks = function() {

            $.ajax( {
                type : 'POST',
                url : ajaxurl,
                context : this,
                data : {
                    action : 'content_standards_get_checks'
                }
            } ).success( function( data ) {

                this.checks = _.mapObject( data, function( check, id ) {
                    return _.extend( check, { id : id } );
                } );

                this.setSettings();

            } ).error( function() {

                $( metaBoxContentSelector ).html( 'Unable to load content standards checks data. Please contact support.' );

            } );

        };

        this.setSettings = function() {

            if ( this.checks.cs_setting_checkdelay ) {
                debounceChecks = this.checks.cs_setting_checkdelay.value;
            }

            if ( this.checks.cs_setting_ignoretags ) {
                var elements = this.checks.cs_setting_ignoretags.value;

                if ( !elements ) {
                    return;
                }

                if ( !_.isArray( elements ) ) {
                    elements = [ elements ];
                }

                ignoreElements = ignoreElements.concat( elements );
            }
        };

        this.runChecks = function() {

            if ( !this.checks ) {
                return;
            }

            this.feedback = [];
            this.setDuplicateContent();
            this.hideDuplicateContentIfNeeded();

            _.each( this.checks, function( check ) {

                if ( !( check.test && check.test.type ) ) {
                    return;
                }

                var testType = check.test.type,
                    checkMethod = 'check' + testType.charAt( 0 ).toUpperCase() + testType.slice( 1 );

                if ( _.isFunction( this[ checkMethod ]) ) {

                    this[ checkMethod ]( check );

                }

            }, this );

            this.showFeedback();

        };

        this.setDuplicateContent = function() {

            this.removeDuplicateContent();
            
            if ( !this.getContentEl() ) {
                return;
            }

            var contentEl = this.getContentEl();
            contentEl.normalize(); // merge adjacent text nodes

            var contentStyle = window.getComputedStyle( contentEl ),
                paddingTop = contentStyle.getPropertyValue( 'padding-top' ),
                marginTop = contentStyle.getPropertyValue( 'margin-top' ),
                marginLeft = contentStyle.getPropertyValue( 'margin-left' );

            this.duplicateContentEl = $( '<div></div>' )
                                        .attr( 'id', 'cs--duplicate-content' )
                                        .css( { 'width' : contentEl.offsetWidth, 'margin-left' : marginLeft, display : 'none' } )
                                        .append(
                                            $( '<div></div>' )
                                                .addClass( isGutenberg ? 'wp-block-freeform block-library-rich-text__tinymce' : '' )
                                                .css( { 'padding-top' : paddingTop, 'margin-top' : marginTop } )
                                                .html( contentEl.innerHTML + ' §§cs§§' )
                                        )
                                        .appendTo( contentEl );

        };

        this.hideDuplicateContentIfNeeded = function() {

            if ( !this.duplicateContentEl ) {
                return;
            }

            this.duplicateContentEl.toggleClass( 'userPreferenceHidden', this.disableInlineHighlight );
        };

        this.removeDuplicateContent = function() {

            if ( this.duplicateContentEl ) {
                this.duplicateContentEl.remove();
            }

            // Doubly sure of any accidentally saved
            if ( this.getContentEl() ) {
                _.each( this.getContentEl().querySelectorAll( '#cs--duplicate-content' ), function( node ) {
                    node.parentNode.removeChild( node );
                } );
            }
        };

        this.addFeedback = function( args ) {

            this.feedback.push( args );

        };

        this.showFeedback = function() {

            var $list = $( '<ul class="feedbacklist"></ul>' ),
                that = this,
                total = 0;

            _.each( this.feedback, function( feedback ) {

                if ( !feedback.message && feedback.matched && feedback.check ) {
                    feedback.message = this.createFeedbackBox( feedback );
                    total += feedback.matched.length;
                }

                $( '<li></li>' )
                    .html( feedback.message )
                    .appendTo( $list );

            }, this );

            this.$summaryEl.empty().append( $list );
            this.$summaryTitleEl.attr( 'data-feedback-total', total );

            $list.on( 'click', '.matches > li:not([data-id=""])', function( event ) {

                var id = event.currentTarget.getAttribute( 'data-id' ),
                    $inlineEl = that.duplicateContentEl.find( '.cs--check[data-id="' + id + '"]' ),
                    inlineElTop = $inlineEl.offset().top,
                    $contentEl = $( that.getContentEl() ),
                    editorDocEl = that.editor.contentDocument.documentElement,
                    $elementsToScroll = null,
                    iFrameHasScrollbars = ( editorDocEl.scrollHeight > ( editorDocEl.clientHeight + 10 ) ),
                    fullHeightEditor = $contentEl.hasClass( 'wp-autoresize' ) || $contentEl[ 0 ].style.overflowY == 'hidden';

                // Scroll to element. Check if there are iframe scrollbars, if not, scroll main window
                if ( isGutenberg ) {
                    $elementsToScroll = $contentEl.closest( '.edit-post-layout__content' );
                    inlineElTop = inlineElTop - $contentEl.offset().top;
                }
                else {
                    $elementsToScroll = iFrameHasScrollbars && !fullHeightEditor ? $contentEl.add( $contentEl.parents( 'html' ) ) : $( 'html, body' );
                }

                $elementsToScroll.animate( { scrollTop : inlineElTop }, 300 );

                // "Flash" element

                $inlineEl.addClass( 'cs--highlight' );

                _.delay( function() {
                    $inlineEl.removeClass( 'cs--highlight' );
                }, removeHighlightAfter );

            } );
        };

        this.createFeedbackBox = function( feedback ) {

            var id = 'cs_box_' + feedback.check.id,
                chboxid = 'check_' + id,
                checked = $( metaBoxContentSelector + ' #' + chboxid ).prop( 'checked' ) ? ' checked' : '',
                html = '<div class="box" id="' + id + '">' +
                       ' <input type="checkbox" class="toggle" name="' + chboxid + '" id="' + chboxid + '"' + checked + ' />' +
                       ' <label for="' + chboxid + '" class="heading"> ' +
                       '  <span class="title">' + feedback.check.boxlabel + '</span>' +
                       '  <span class="count">' + feedback.matched.length + '</span>' +
                       ' </label>' +
                       ' <ul class="matches">';

            _.each( feedback.matched, function( match, i ) {
                html += '<li data-id="' + ( feedback.ids ? feedback.ids[ i ] : '' ) + '">' + match + '</li>';
            } );

            html +=    ' </ul>' +
                       '</div>';

            return html;
        };

        this.getNodesToCheck = function() {

            return this.duplicateContentEl ? this.duplicateContentEl[ 0 ].childNodes : [];

        };

        // GENERIC CHECK FUNCTIONS //

        this.genericWordlistCheck = function( check, options ) {

            options = options || {};

            var regexpwhitelist = check.test.whitelist ? new RegExp( '\\b' + check.test.whitelist + '\\b', check.test.whitelistflags || 'i' ) : null,
                matchedTerms = [],
                matchIds = [],
                id;

            if ( !check.test.regexp ) {
                check.test.regexp = new RegExp( '\\b(' + _.values( check.test.wordlist ).join( '|' ) + ')\\b', 'gi' );
            }

            _.each( this.getNodesToCheck(), function( node ) {

                findAndReplaceDOMText(
                    node,
                    {
                        find : check.test.regexp,
                        filterElements : filterElementsDuringMatch,
                        preset : 'prose',
                        replace : function( portion, p1 ) {

                            var match = portion.text,
                                matchText = p1[ 0 ],
                                pattern = '',
                                suggestion = '',
                                reResult = null;

                            if ( regexpwhitelist && matchText.match( regexpwhitelist ) ) {
                                return match;
                            }

                            id = check.id + '_' + p1.startIndex;

                            if ( portion.index === 0 ) {

                                if ( check.test.feedback.indexOf( '$suggestion' ) > -1 || check.test.feedback.indexOf( '$pattern' ) > -1 ) {
                                    _.each( check.test.wordlist, function( thisPattern, thisSuggestion ) {

                                        if ( suggestion ) {
                                            return;
                                        }

                                        reResult = matchText.match( new RegExp( thisPattern, 'i' ) );

                                        if ( reResult ) {
                                            pattern = thisPattern;
                                            suggestion = thisSuggestion;
                                        }
                                    } );
                                }

                                if ( options.mustMatchCase && matchText == pattern ) {
                                    return match;
                                }

                                matchIds.push( id );
                                matchedTerms.push(
                                    check.test.feedback.replace( '$suggestion', suggestion ).replace( '$match', matchText ).replace( '$pattern', pattern )
                                );
                            }

                            return getHighlightNode( check, match, id );
                        }
                    }
                );

            }, this );

            if ( matchedTerms.length ) {
                this.addFeedback( {
                    check : check,
                    matched : matchedTerms,
                    ids : matchIds
                } );
            }

        };

        this.checkRegexp = function( check ) {

            var regexpwhitelist = check.test.whitelist ? new RegExp( '\\b' + check.test.whitelist + '\\b', check.test.whitelistflags || 'i' ) : null,
                matchedTerms = [],
                matchIds = [],
                id;

            this.compileCheckRegExps( check, false );

            _.each( check.test.compiled, function( regexp, index ) {

                var feedback = ( _.isObject( check.test.feedback ) && check.test.feedback[ index ] ? check.test.feedback[ index ] : check.test.feedback );

                _.each( this.getNodesToCheck(), function( node ) {

                    findAndReplaceDOMText(
                        node,
                        {
                            find : regexp,
                            filterElements : filterElementsDuringMatch,
                            preset : 'prose',
                            replace : function( portion, p1 ) {

                                var fullMatch = p1[ 0 ];

                                if ( regexpwhitelist && fullMatch.match( regexpwhitelist ) ) {
                                    return portion.text;
                                }

                                id = check.id + '_' + p1.startIndex;

                                if ( portion.index === 0 ) {
                                    matchIds.push( id );
                                    matchedTerms.push( feedback.replace( '$match', fullMatch ) );
                                }

                                return getHighlightNode( check, portion.text, id );
                            }
                        }
                    );

                }, this );

            }, this );

            if ( matchedTerms.length ) {
                this.addFeedback( {
                    check : check,
                    matched : matchedTerms,
                    ids : matchIds
                } );
            }
        };

        // SPECIFIC CHECKS //

        this.checkSuggestWordInsteadOf = function( check ) {
            this.genericWordlistCheck( check );
        };

        this.checkBlacklist = function( check ) {
            this.genericWordlistCheck( check );
        };

        this.checkPreferred = function( check ) {
            this.genericWordlistCheck( check );
        };

        this.checkCapitalized = function( check ) {
            this.genericWordlistCheck( check, { mustMatchCase : true } );
        };

        this.checkOptionalregexp = function( check ) {
            this.checkRegexp( check );
        };

        this.checkContractions = function( check ) {

            if ( !this.mappedContractions ) {

                var contractionWordList = _.mapObject( check.test.wordlist, function( val ) {
                        return check.value === 'avoid' ? val.join( ' or ' ) : '(' + val.join( '|' ) + ')';
                    } );

                if ( check.value === 'avoid' ) {
                    contractionWordList = _.invert( contractionWordList );
                }

                check.test.wordlist = contractionWordList;
                this.mappedContractions = true;
            }

            this.genericWordlistCheck( check );
        };

        this.checkRedundancies = function( check ) {

            var matchedTerms = [],
                matchIds = [],
                id;

            if ( _.isArray( check.test.regexp ) ) {
                check.test.origRegexp = check.test.regexp;
                check.test.regexp = check.test.regexp.join( '|' );
            }

            this.compileCheckRegExps( check, true );

            _.each( check.test.compiled, function( regexp ) {

                _.each( this.getNodesToCheck(), function( node ) {

                    findAndReplaceDOMText(
                        node,
                        {
                            find : regexp,
                            filterElements : filterElementsDuringMatch,
                            preset : 'prose',
                            replace : function( portion, p1 ) {

                                var match = portion.text,
                                    matchText = '',
                                    replaceText = '',
                                    reResult = null;

                                id = check.id + '_' + p1.startIndex;

                                if ( portion.index === 0 ) {

                                    matchText = p1[ 0 ];

                                    check.test.origRegexp.some( function( re ) {

                                        reResult = matchText.match( new RegExp( re, 'i' ) );

                                        if ( reResult ) {
                                            replaceText = reResult[ 1 ];
                                            return true;
                                        }
                                    } );

                                    matchIds.push( id );
                                    matchedTerms.push( check.test.feedback.replace( '$match', matchText ).replace( '$1', replaceText ) );
                                }

                                return getHighlightNode( check, match, id );
                            }
                        }
                    );

                }, this );

            }, this );

            if ( matchedTerms.length ) {
                this.addFeedback( {
                    check : check,
                    matched : matchedTerms,
                    ids : matchIds
                } );
            }
        };

        this.checkDateformat = function( check ) {

            var matchedTerms = [],
                matchIds = [],
                userformat = check.value,
                that = this,
                id;

            this.compileCheckRegExps( check, true );

            _.each( check.test.compiled, function( regexp ) {

                _.each( this.getNodesToCheck(), function( node ) {

                    findAndReplaceDOMText(
                        node,
                        {
                            find : regexp,
                            filterElements : filterElementsDuringMatch,
                            preset : 'prose',
                            replace : function( portion, p1 ) {

                                var match = portion.text,
                                    datestring = match.replace( /\u00A0/g, ' ' ).trim().replace( /,$/, '' ), // convert non-breaking spaces to normal, remove extraneous comma
                                    date = that.getDateFromString( datestring ),
                                    expectedstring = that.formatDate( date, userformat );

                                if ( expectedstring.indexOf( datestring ) > -1 ) {
                                    return match;
                                }

                                id = check.id + '_' + p1.startIndex;

                                if ( portion.index === 0 ) {
                                    matchIds.push( id );
                                    matchedTerms.push( check.test.feedback.replace( '$match', datestring ).replace( '$suggestion', expectedstring ) );
                                }

                                return getHighlightNode( check, match, id );
                            }
                        }
                    );

                }, this );

            }, this );

            if ( matchedTerms.length ) {
                this.addFeedback( {
                    check : check,
                    matched : matchedTerms,
                    ids : matchIds
                } );
            }
        };

        this.checkLongsentence = function( check ) {

            var matchedTerms = [],
                matchIds = [],
                html = this.duplicateContentEl.html(),
                minimumSentenceLengthToCheck = check.value * 2; // optimization; only checks sentences longer than "i a i a i " etc for word count;

            // Markup spans as character codes for now, so we can easily correct bad ones first before changing to HTML tags
            html = html
                    .replace( /\b(Mr|Ms|Mrs|Dr|U\.S|Col|Sgt|Lt|Adm|Maj|Sen|Rep|Jan|Feb|Apr|Mar|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Pvt|Cpl|Capt|Gen|Ave|St|inc|ft|Gov|Jr|Sr|ltd|Rev|M|Mme|Prof|Pres|Hon|[A-Z])(\.)\s/g, '§§SP§§$1$2§§SC§§ ' )
                    .replace( /(etc|vs|\.\.|e\.g|i\.e|a\.m|p\.m)(\.)(\"|\\u201d)?(\s)?([a-z])/g, '§§SP§§$1§§SC§§$3$4$5' )
                    .replace( /(<(p|h1|h2|h3)[^>]*>)/gi, '$1§§SS§§' )
                    .replace( /(<\/(p|h1|h2|h3)>)/gi, '§§SC§§$1' )
                    .replace( /(<li>)(<p>)?/gi, '$1$2§§SS§§' )
                    .replace( /(<ul><li>[\s\S]*?)(<ul>[\s\S]*?<\/ul>)?(<\/li>)/gi, '$1§§SC§§$2$3' )
                    .replace( /([\.\?\!])(\)|\"|”|\'|’|&#39;|&#34;|&quot;|&rdquo;)?(<\/p><p>)?( |&nbsp;)/g, '$1$2§§SC§§$3$4§§SS§§' )
                    // Remove incorrect markup of sentences "inside" of tags (e.g. title attributes)
                    // Quicker to do this - remove bad ones - than corectly only mark up to node text in the first instance
                    .replace( /<[^>]+(§§S\w§§[^>]*)+>/g, function( fullMatch ) {
                        return fullMatch.replace( /§§S\w§§/g, '' );
                    } )
                    // replace character codes with HTML spans
                    .replace( /§§SP§§/g, '<span class="cs-protected">' )
                    .replace( /§§SS§§/g, '<x-sentence class="cs-sentence">' )
                    .replace( /§§SC§§/g, '</x-sentence>' );

            this.duplicateContentEl.html( html );

            this.duplicateContentEl.find( '.cs-sentence' ).each( function( i, sentence ) {

                var sentenceText = ( sentence.textContent || '' );

                if ( sentenceText.length < minimumSentenceLengthToCheck ) {
                    return;
                }

                var numWords = sentenceText.replace( /\s+[^a-z0-9]+\s+/ig, ' ' ).split( /\s+/ ).length;

                if ( numWords > check.value ) {

                    var id = _.uniqueId();
                    matchIds.push( id );

                    $( sentence ).addClass( 'cs--check ' + check.id ).attr( 'data-id', id );

                    matchedTerms.push( check.test.feedback.replace( '$match', sentenceText ) );
                }
            } );

            if ( matchedTerms.length ) {
                this.addFeedback( {
                    check : check,
                    matched : matchedTerms,
                    ids : matchIds
                } );
            }
        };

        this.checkMandatoryTag = function( check ) {

            if ( this.duplicateContentEl.find( check.test.tag ).length === 0 ) {

                this.addFeedback( {
                    check : check,
                    matched : [ check.test.feedback ],
                } );
            }
        };

        this.checkVariedStructure = function( check ) {

            var numInteresting = this.duplicateContentEl.find( visuallyInterestingElements ).length,
                numBoring = this.duplicateContentEl.find( 'p,div' ).filter( function() {

                    var hasText = ( this.textContent || '' ).trim().length > 0,
                        notInList = this.parentNode.tagName.toLowerCase() !== 'li';

                    return hasText && notInList;

                } ).length,
                ratio = ( numInteresting / ( numBoring || 1 ) );

            // Only check when more than 1 paragraph
            if ( numBoring > 1 && ratio < check.value ) {

                this.addFeedback( {
                    check : check,
                    matched : [ check.test.feedback ]
                } );

            }
        };

        this.compileCheckRegExps = function( check, addWordBoundaries ) {

            if ( check.test.compiled ) {
                return;
            }

            var flags = check.test.regexpflags || 'gi',
                isArray = _.isArray( check.test.regexp ),
                isObject = _.isObject( check.test.regexp ),
                regexps = isArray || isObject ? check.test.regexp : [ check.test.regexp ];

            check.test.compiled = isObject ? {} : [];

            _.each( regexps, function( regexp, index ) {
                check.test.compiled[ index ] = new RegExp( addWordBoundaries ? '\\b' + regexp + '\\b' : regexp, flags );
            } );

        };

        this.normalizeHtml = function( html ) {
            return html
                    .replace( /\s*§§cs§§\s*/, '' )
                    .replace( /([^\.])<\/(li|p|h\d|dd)>\s*/g, '$1. ' )   // convert end of certain tags to full stops
                    .replace( /<[^>]+>/g, '' )                        // Strip tags
                    .replace( /https?:\/\/[^\s]+/gi, 'URL' )        // Replace inline URLs
                    .replace( /&amp;/g, '&' )                       // Replace common HTML entity
                    .replace( /(\d),(\d)/g, '$1$2' )                 // Before replacing commas with spaces, remove from numbers like 1,000
                    .replace( /(&nbsp;|&#160;|["“”,:;()\—\- ])/g, ' ' )    // Replace commas, hyphens, nbsps etc (count them as spaces)
                    .replace( /(^|\b)(Mr|Mrs|Dr|Jr)\. /g, '$2 ' )    // Remove . from honorific titles
                    .replace( /(^|\s)(([A-Z]\.){2,})($|\s)/g, function( match, p1, p2, p3, p4 ) {  // Remove . from N.A.S.A. and U.S. type acronyms
                        return p1 + p2.replace( /\./g, '' ) + p4;
                    } )
                    .replace( /\s*[\.!?]+/g, '.' )                    // Unify terminators (and remove any whitespace before)
                    .replace( /^\s+/, '' )                            // Strip leading whitespace
                    .replace( /\s+/g, ' ' )                            // Replace multiple whitespace (inc new lines) with single space
                    .replace( /\.(\w)/g, '. $1' )                   // Pad terminators correctly
                    .replace( /[\s\.!?]+$/, '' );                    // Strip trailing whitespace and terminators
        };

        this.checkStatistics = function( check ) {

            var html = this.normalizeHtml( this.duplicateContentEl.html() );

            if ( html.length ) {
                html = html + '.';  // Add final terminator
            }

            // Replace any symbol characters with whitespace either side that aren't "words" before counting e.g. ellipses, dashes, etc
            var words = html.length ? html.replace( /\s+[^a-z0-9]+\s+/ig, ' ' ).split( /\s+/ ).length : 0,
                sentences = html.length ? html.match( /[\.!?]/g ).length : 0,
                letters = html.length ? html.replace( /[^a-z]+/ig, '' ).length : 0,
                grade = Math.ceil( Math.round( ( ( 4.71 * ( letters / words ) ) + ( 0.5 * ( words / ( sentences || 1 ) ) ) - 21.43 ) * 10 ) / 10 ),
                readmins = words / wpmReadTime,
                readingtime = ( readmins < 1 && words > 0 ? '< ' : '' ) + Math.ceil( readmins ) + ' min' + ( readmins >= 2 ? 's' : '' ),
                message = '<ul class="stats">' +
                          ' <li><b>Words</b><em>' + words + '</em></li>' +
                          ' <li><b>Sentences</b><em>' + sentences + '</em></li>' +
                          ' <li><b>Reading Time</b><em class="noformat">' + readingtime + '</em></li>' +
                          ' <li><b>Readability Grade</b><em class="noformat">' + ( grade >= minReadingGrade ? grade : 'Not enough text' ) + '</em></li>' +
                          '</ul>';

            this.addFeedback( {
                message : message,
                check : check
            } );
        };

        this.checkMinimumWordCount = function( check ) {

            if ( check.value == 0 ) {
                return;
            }

            var html = this.normalizeHtml( this.duplicateContentEl.html() ),
                words = html.length ? html.replace( /\s+[^a-z0-9]+\s+/ig, ' ' ).split( /\s+/ ).length : 0;

            if ( words < check.value ) {

                this.addFeedback( {
                    check : check,
                    matched : [ check.test.feedback.replace( '$min', check.value ).replace( '$num', words ) ]
                } );
            }
        };

        // UTIL FUNCTIONS //

        this.getDateFromString = function( datestring ) {

            var day = null,
                month = null,
                year = null,
                remaining;

            datestring = datestring
                            // Normalize string; remove unnecessary chars
                            .replace( /(^\s+|st|nd|rd|th|,|\s+$)/gi, '' )
                            .replace( /[\-\/\.]/g, ' ' )
                            .replace( /\s+/g, ' ' )
                            // Remove year
                            .replace( /\d{4}/, function( match ) {
                                year = Number( match );
                                return '';
                            } )
                            // Remove month names
                            .replace( /(^|\b)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(\b|$)/i, function( match, m1, m2 ) {
                                month = Number( monthNames[ m2.toLowerCase() ] );
                                return '';
                            } )
                            // If only one number left, it's the day; also if it's over 12
                            .replace( /(^[^\d]*(\d+)[^\d]*$|(^|\b)(1[3-9]|2\d|3[01])(\b|$))/, function( match, fullgroup, digits, secondgroup, morethantwelve ) {
                                day = Number( digits || morethantwelve );
                                return '';
                            } );

            if ( year && day && month === null ) { // Remaining number is now month
                datestring = datestring.replace( /^[^\d]*(\d+)[^\d]*$/, function( match, digits ) {
                    month = Number( digits ) - 1;
                    return '';
                } );
            }

            if ( day && month === null && year == null ) {
                // assume month and year remaining, i.e. it was in dd/mm/yy format
                remaining = datestring.match( /\d+/g );

                if ( remaining && remaining.length == 2 ) {
                    month = Number( remaining[ 0 ] ) - 1;
                    year = remaining[ 1 ];

                    if ( year.length == 2 ) {
                        var thisYear = new Date().getFullYear();
                        year = Number( ( thisYear.toString().substring( 0, 2 ) ) + year );

                        if ( year > thisYear ) {
                            year = year - 100;
                        }
                    }

                    year = Number( year );
                }
            }

            if ( month === null || day === null ) {
                // From here on, will be best guess. Assume month first, as fits both ISO YYYY-MM-DD format and US default MM/DD/YYYY
                remaining = datestring.match( /\d+/g );

                if ( remaining && remaining.length == 2 ) {
                    month = Number( remaining[ 0 ] ) - 1;
                    day = Number( remaining[ 1 ] );
                }
            }

            if ( year === null ) {
                year = new Date().getFullYear();
            }

            return new Date( year, month, day );
        };

        this.formatDate = function( date, userformat ) {

            var pad = function( n ) {
                return ( n < 10 ) ? ( '0' + n ) : n;
            };

            return userformat.replace( /[a-z]/gi, function( letter ) {
                switch( letter ) {
                    case 'd':
                        return pad( date.getDate() );
                    case 'j':
                        return date.getDate();
                    case 'S':
                        var n = date.getDate(),
                            s = [ 'th', 'st', 'nd', 'rd' ],
                            v = n % 100;
                        return ( s [ ( v - 20 ) % 10 ] || s[ v ] || s[ 0 ] );
                    case 'F':
                        return longMonthNames[ date.getMonth() ];
                    case 'm':
                        return pad( date.getMonth() + 1 );
                    case 'Y':
                        return date.getFullYear();
                }
            } );
        };

    }

    /* *********************************************************************************************************************** */

    var Checker = new ContentStandards();
    Checker.loadChecks();

    $( document ).on( 'tinymce-editor-init', function( event, editor ) {

        if ( tinyMceLoaded ) { // In the case of multiple on same page
            return;
        }

        tinyMceLoaded = true;
        isGutenberg = $( '#editor.gutenberg__editor, body.gutenberg-editor-page' ).length > 0;

        if ( !Checker.setSummaryElement( $( metaBoxContentSelector ), $( metaBoxTitleSelector ) ) ) {
            return;
        }

        Checker.setEditor( editor );
        Checker.setupEvents();

        setupStyleGuideModal();
        setupPopOpenToggle();

    } );

    // If tinymce not initiated after X seconds, display error message (TinyMCE not found, or in Text mode by default / on load)
    _.delay( function() {
        if ( !tinyMceLoaded ) {
            $( metaBoxContentSelector ).html( 'The Style Guide only works when the WYSIWYG editor is in Visual editing mode.' );
        }
    }, warnNoTinyMceDelay );

    /* *********************************************************************************************************************** */

}( jQuery ));
