/* globals wp_stream, ajaxurl */
jQuery(function( $ ) {

	$( '.toplevel_page_wp_stream :input.chosen-select' ).each(function( i, el ) {
		var args = {},
			formatResult = function( record, container ) {
				var result = '',
					$elem = $( record.element ),
					icon = '';

				if ( '- ' === record.text.substring( 0, 2 ) ) {
					record.text = record.text.substring( 2 );
				}

				if ( undefined !== record.icon ) {
					icon = record.icon;
				} else if ( undefined !== $elem.attr( 'data-icon' ) ) {
					icon = $elem.data( 'icon' );
				}
				if ( icon ) {
					result += '<img src="' + icon + '" class="wp-stream-select2-icon">';
				}

				result += record.text;

				// Add more info to the container
				container.attr( 'title', $elem.attr( 'title' ) );

				return result;
			},
			formatSelection = function( record ) {
				if ( '- ' === record.text.substring( 0, 2 ) ) {
					record.text = record.text.substring( 2 );
				}
				return record.text;
			};

		if ( $( el ).find( 'option' ).length > 0 ) {
			args = {
				minimumResultsForSearch: 10,
				formatResult: formatResult,
				formatSelection: formatSelection,
				allowClear: true,
				width: '165px'
			};
		} else {
			args = {
				minimumInputLength: 3,
				allowClear: true,
				width: '165px',
				ajax: {
					url: ajaxurl,
					datatype: 'json',
					data: function( term ) {
						return {
							action: 'wp_stream_filters',
							filter: $( el ).attr( 'name' ),
							q: term
						};
					},
					results: function( data ) {
						return { results: data };
					}
				},
				formatResult: formatResult,
				formatSelection: formatSelection,
				initSelection: function( element, callback ) {
					var id = $( element ).val();
					if ( '' !== id ) {
						$.post(
							ajaxurl,
							{
								action: 'wp_stream_get_filter_value_by_id',
								filter: $(element).attr('name'),
								id: id
							},
							function( response ) {
								callback({
									id: id,
									text: response
								});
							},
							'json'
						);
					}
				}
			};
		}

		$( el ).select2( args );
	});

	var $queryVars    = $.streamGetQueryVars();
	var $contextInput = $( '.toplevel_page_wp_stream :input.chosen-select[name=context]' );

	if ( ( 'undefined' === typeof $queryVars.context || '' === $queryVars.context ) && 'undefined' !== typeof $queryVars.connector ) {
		$contextInput.select2( 'val', 'group-' + $queryVars.connector );
	}

	$( '#record-filter-form' ).submit( function() {
		var	$context        = $( '.toplevel_page_wp_stream :input.chosen-select[name=context]' ),
			$option         = $context.find( 'option:selected' ),
			$connector      = $context.parent().find( '.record-filter-connector' ),
			optionConnector = $option.data( 'group' ),
			optionClass     = $option.prop( 'class' );

		$connector.val( optionConnector );

		if ( 'level-1' === optionClass ) {
			$option.val('');
		}
	});

	$( window ).load( function() {
		$( '.toplevel_page_wp_stream [type=search]' ).off( 'mousedown' );
	});

	$( '#stream-start-sync' ).click( function( e ) {
		if ( ! confirm( wp_stream.i18n.confirm_start_sync ) ) {
			e.preventDefault();
		}
	});

	$( '#stream-sync-reminder' ).click( function( e ) {
		if ( ! confirm( wp_stream.i18n.confirm_sync_reminder ) ) {
			e.preventDefault();
		}
	});

	$( '#stream-delete-records' ).click( function( e ) {
		if ( ! confirm( wp_stream.i18n.confirm_delete_records ) ) {
			e.preventDefault();
		}
	});

	// Admin page tabs
	var $tabs          = $( '.nav-tab-wrapper' ),
		$panels        = $( '.nav-tab-content table.form-table' ),
		$activeTab     = $tabs.find( '.nav-tab-active' ),
		defaultIndex   = $activeTab.length > 0 ? $tabs.find( 'a' ).index( $activeTab ) : 0,
		hashIndex      = window.location.hash.match( /^#(\d+)$/ ),
		currentHash    = ( null !== hashIndex ? hashIndex[ 1 ] : defaultIndex ),
		syncFormAction = function( index ) {
			var $optionsForm  = $( 'input[name="option_page"][value^="wp_stream"]' ).closest( 'form' );
			var currentAction = $optionsForm.attr( 'action' );

			$optionsForm.prop( 'action', currentAction.replace( /(^[^#]*).*$/, '$1#' + index ) );
		};

	$tabs.on( 'click', 'a', function() {
		var index     = $tabs.find( 'a' ).index( $( this ) ),
			hashIndex = window.location.hash.match( /^#(\d+)$/ );

		$panels.hide().eq( index ).show();
		$tabs
			.find( 'a' )
			.removeClass( 'nav-tab-active' )
			.filter( $( this ) )
			.addClass( 'nav-tab-active' );

		if ( '' === window.location.hash || null !== hashIndex ) {
			window.location.hash = index;
		}

		syncFormAction( index );
		return false;
	});
	$tabs.children().eq( currentHash ).trigger( 'click' );

	// Live Updates screen option
	$( document ).ready(function() {

		// Only run on page 1 when the order is desc and on page wp_stream
		if (
			'toplevel_page_wp_stream' !== wp_stream.current_screen ||
			'1' !== wp_stream.current_page ||
			'asc' === wp_stream.current_order
		) {
			return;
		}

		var list_sel = '.toplevel_page_wp_stream #the-list';

		// Set initial beat to fast. WP is designed to slow this to 15 seconds after 2.5 minutes.
		wp.heartbeat.interval( 'fast' );

		$( document ).on( 'heartbeat-send.stream', function( e, data ) {
			data['wp-stream-heartbeat'] = 'live-update';
			var last_item = $( list_sel + ' tr:first .record-created' );
			var last_time;
			if ( last_item.length !== 0 ) {
				last_time = last_item.attr( 'datetime' );
				data['wp-stream-heartbeat-last-time'] = last_time;
				data['wp-stream-heartbeat-query']     = wp_stream.current_query;
			}
		});

		// Listen for "heartbeat-tick" on $(document).
		$( document ).on( 'heartbeat-tick.stream', function( e, data ) {

			// If this no rows return then we kill the script
			if ( ! data['wp-stream-heartbeat'] || 0 === data['wp-stream-heartbeat'].length ) {
				return;
			}

			// Get show on screen
			var show_on_screen = $( '#edit_stream_per_page' ).val();

			// Get all current rows
			var $current_items = $( list_sel + ' tr' );

			// Get all new rows
			var $new_items = $( data['wp-stream-heartbeat'] );

			// Remove all class to tr added by WP and add new row class
			$new_items.removeClass().addClass( 'new-row' );

			//Check if first tr has the alternate class
			var has_class = ( $current_items.first().hasClass( 'alternate' ) );

			// Apply the good class to the list
			if ( $new_items.length === 1 && ! has_class ) {
				$new_items.addClass( 'alternate' );
			} else {
				var even_or_odd = ( 0 === $new_items.length % 2 && ! has_class ) ? 'even' : 'odd';
				// Add class to nth child because there is more than one element
				$new_items.filter( ':nth-child(' + even_or_odd + ')' ).addClass( 'alternate' );
			}

			// Add element to the dom
			$( list_sel ).prepend( $new_items );

			$( '.metabox-prefs input' ).each(function() {
				if ( true !== $( this ).prop( 'checked' ) ) {
					var label = $( this ).val();
					$( 'td.column-' + label ).hide();
				}
			});

			// Remove the number of element added to the end of the list table
			var slice_rows = show_on_screen - ( $new_items.length + $current_items.length );
			if ( slice_rows < 0 ) {
				$( list_sel + ' tr' ).slice( slice_rows ).remove();
			}

			// Remove the no items row
			$( list_sel + ' tr.no-items' ).remove();

			// Update pagination
			var total_items_i18n = data.total_items_i18n || '';
			if ( total_items_i18n ) {
				$( '.displaying-num' ).text( total_items_i18n );
				$( '.total-pages' ).text( data.total_pages_i18n );
				$( '.tablenav-pages' ).find( '.next-page, .last-page' ).toggleClass( 'disabled', data.total_pages === $( '.current-page' ).val() );
				$( '.tablenav-pages .last-page' ).attr( 'href', data.last_page_link );
			}

			// Allow others to hook in, ie: timeago
			$( list_sel ).parent().trigger( 'updated' );

			// Remove background after a certain amount of time
			setTimeout(function() {
				$('.new-row').addClass( 'fadeout' );
				setTimeout(function() {
					$( list_sel + ' tr' ).removeClass( 'new-row fadeout' );
				}, 500 );
			}, 3000 );

		});

		//Enable Live Update Checkbox Ajax
		$( '#enable_live_update' ).click(function() {
			var nonce     = $( '#stream_live_update_nonce' ).val(),
				user      = $( '#enable_live_update_user' ).val(),
				checked   = 'unchecked',
				heartbeat = 'true';

			if ( $( '#enable_live_update' ).is( ':checked' ) ) {
				checked = 'checked';
			}

			heartbeat = $( '#enable_live_update' ).data( 'heartbeat' );

			$.ajax({
				type: 'POST',
				url: ajaxurl,
				data: {
					action: 'stream_enable_live_update',
					nonce: nonce,
					user: user,
					checked: checked,
					heartbeat: heartbeat
				},
				dataType: 'json',
				beforeSend: function() {
					$( '.stream-live-update-checkbox .spinner' ).show().css( { 'display': 'inline-block' } );
				},
				success: function( response ) {
					$( '.stream-live-update-checkbox .spinner' ).hide();

					if ( false === response.success ) {
						$( '#enable_live_update' ).prop( 'checked', false );

						if ( response.data ) {
							window.alert( response.data );
						}
					}
				}
			});
		});

		function toggle_filter_submit() {
			var all_hidden = true;

			// If all filters are hidden, hide the button
			if ( $( 'div.metabox-prefs [id="date-hide"]' ).is( ':checked' ) ) {
				all_hidden = false;
			}

			var divs = $( 'div.alignleft.actions div.select2-container' );

			divs.each(function() {
				if ( ! $( this ).is( ':hidden' ) ) {
					all_hidden = false;
					return false;
				}
			});

			if ( all_hidden ) {
				$( 'input#record-query-submit' ).hide();
				$( 'span.filter_info' ).show();
			} else {
				$( 'input#record-query-submit' ).show();
				$( 'span.filter_info' ).hide();
			}
		}

		if ( $( 'div.metabox-prefs [id="date-hide"]' ).is( ':checked' ) ) {
			$( 'div.date-interval' ).show();
		} else {
			$( 'div.date-interval' ).hide();
		}

		$( 'div.actions select.chosen-select' ).each(function() {
			var name = $( this ).prop( 'name' );

			if ( $( 'div.metabox-prefs [id="' + name + '-hide"]' ).is( ':checked' ) ) {
				$( this ).prev( '.select2-container' ).show();
			} else {
				$( this ).prev( '.select2-container' ).hide();
			}
		});

		toggle_filter_submit();

		$( 'div.metabox-prefs [type="checkbox"]' ).click(function() {
			var id = $( this ).prop( 'id' );

			if ( 'date-hide' === id ) {
				if ( $( this ).is( ':checked' ) ) {
					$( 'div.date-interval' ).show();
				} else {
					$( 'div.date-interval' ).hide();
				}
			} else {
				id = id.replace( '-hide', '' );

				if ( $( this ).is( ':checked' ) ) {
					$( '[name="' + id + '"]' ).prev( '.select2-container' ).show();
				} else {
					$( '[name="' + id + '"]' ).prev( '.select2-container' ).hide();
				}
			}

			toggle_filter_submit();
		});

		$( '#ui-datepicker-div' ).addClass( 'stream-datepicker' );
	});

	// Relative time
	$( 'table.wp-list-table' ).on( 'updated', function() {
		var timeObjects = $( this ).find( 'time.relative-time' );
		timeObjects.each( function( i, el ) {
			var timeEl = $( el );
			timeEl.removeClass( 'relative-time' );
			$( '<strong><time datetime="' + timeEl.attr( 'datetime' ) + '" class="timeago"/></time></strong><br/>' )
				.prependTo( timeEl.parent().parent() )
				.find( 'time.timeago' )
				.timeago();
		});
	}).trigger( 'updated' );

	var intervals = {
		init: function( $wrapper ) {
			this.wrapper = $wrapper;
			this.save_interval( this.wrapper.find( '.button-primary' ), this.wrapper );

			this.$ = this.wrapper.each( function( i, val ) {
				var container   = $( val ),
					dateinputs  = container.find( '.date-inputs' ),
					from        = container.find( '.field-from' ),
					to          = container.find( '.field-to' ),
					to_remove   = to.prev( '.date-remove' ),
					from_remove = from.prev( '.date-remove' ),
					predefined  = container.children( '.field-predefined' ),
					datepickers = $( '' ).add( to ).add( from );

				if ( jQuery.datepicker ) {

					// Apply a GMT offset due to Date() using the visitor's local time
					var	siteGMTOffsetHours  = parseFloat( wp_stream.gmt_offset ),
						localGMTOffsetHours = new Date().getTimezoneOffset() / 60 * -1,
						totalGMTOffsetHours = siteGMTOffsetHours - localGMTOffsetHours,
						localTime           = new Date(),
						siteTime            = new Date( localTime.getTime() + ( totalGMTOffsetHours * 60 * 60 * 1000 ) ),
						dayOffset           = '0';

					// check if the site date is different from the local date, and set a day offset
					if ( localTime.getDate() !== siteTime.getDate() || localTime.getMonth() !== siteTime.getMonth() ) {
						if ( localTime.getTime() < siteTime.getTime() ) {
							dayOffset = '+1d';
						} else {
							dayOffset = '-1d';
						}
					}

					datepickers.datepicker({
						dateFormat: 'yy/mm/dd',
						maxDate: dayOffset,
						defaultDate: siteTime,
						beforeShow: function() {
							$( this ).prop( 'disabled', true );
						},
						onClose: function() {
							$( this ).prop( 'disabled', false );
						}
					});

					datepickers.datepicker( 'widget' ).addClass( 'stream-datepicker' );
				}

				predefined.select2({
					'allowClear': true
				});

				if ( '' !== from.val() ) {
					from_remove.show();
				}

				if ( '' !== to.val() ) {
					to_remove.show();
				}

				predefined.on({
					'change': function () {
						var value    = $( this ).val(),
							option   = predefined.find( '[value="' + value + '"]' ),
							to_val   = option.data( 'to' ),
							from_val = option.data( 'from' );

						if ( 'custom' === value ) {
							dateinputs.show();
							return false;
						} else {
							dateinputs.hide();
							datepickers.datepicker( 'hide' );
						}

						from.val( from_val ).trigger( 'change', [ true ] );
						to.val( to_val ).trigger( 'change', [ true ] );

						if ( jQuery.datepicker && datepickers.datepicker( 'widget' ).is( ':visible' ) ) {
							datepickers.datepicker( 'refresh' ).datepicker( 'hide' );
						}
					},
					'select2-removed': function() {
						predefined.val( '' ).trigger( 'change' );
					},
					'check_options': function () {
						if ( '' !== to.val() && '' !== from.val() ) {
							var	option = predefined
								.find( 'option' )
								.filter( '[data-to="' + to.val() + '"]' )
								.filter( '[data-from="' + from.val() + '"]' );
							if ( 0 !== option.length ) {
								predefined.val( option.attr( 'value' ) ).trigger( 'change', [ true ] );
							} else {
								predefined.val( 'custom' ).trigger( 'change', [ true ] );
							}
						} else if ( '' === to.val() && '' === from.val() ) {
							predefined.val( '' ).trigger( 'change', [ true ] );
						} else {
							predefined.val( 'custom' ).trigger( 'change', [ true ] );
						}
					}
				});

				from.on( 'change', function() {
					if ( '' !== from.val() ) {
						from_remove.show();
						to.datepicker( 'option', 'minDate', from.val() );
					} else {
						from_remove.hide();
					}

					if ( true === arguments[ arguments.length - 1 ] ) {
						return false;
					}

					predefined.trigger( 'check_options' );
				});

				to.on( 'change', function() {
					if ( '' !== to.val() ) {
						to_remove.show();
						from.datepicker( 'option', 'maxDate', to.val() );
					} else {
						to_remove.hide();
					}

					if ( true === arguments[ arguments.length - 1 ] ) {
						return false;
					}

					predefined.trigger( 'check_options' );
				});

				// Trigger change on load
				predefined.trigger( 'change' );

				$( '' ).add( from_remove ).add( to_remove ).on( 'click', function() {
					$( this ).next( 'input' ).val( '' ).trigger( 'change' );
				});
			});
		},

		save_interval: function( $btn ) {
			var $wrapper = this.wrapper;
			$btn.click( function() {
				var data = {
					key:   $wrapper.find( 'select.field-predefined' ).find( ':selected' ).val(),
					start: $wrapper.find( '.date-inputs .field-from' ).val(),
					end:   $wrapper.find( '.date-inputs .field-to' ).val()
				};

				// Add params to URL
				$( this ).attr( 'href', $( this ).attr( 'href' ) + '&' + $.param( data ) );
			});
		}
	};

	$( '.wp-stream-feeds-key #stream_user_feed_key_generate' ).click( function( e ) {
		e.preventDefault();

		var user = $( '#user_id' ).val(),
			nonce  = $( '.wp-stream-feeds-key #wp_stream_generate_key_nonce' ).val();

		$.ajax({
			type: 'POST',
			url: ajaxurl,
			data: { action: 'wp_stream_feed_key_generate', nonce: nonce, user: user },
			dataType: 'json',
			beforeSend: function() {
				$( '.wp-stream-feeds-key .spinner' ).show().css( { 'display': 'inline-block' } );
			},
			success: function( response ) {
				$( '.wp-stream-feeds-key .spinner' ).hide();
				if ( true === response.success || undefined !== response.data ) {
					$( '.wp-stream-feeds-key #stream_user_feed_key' ).val( response.data.feed_key );
					$( '.wp-stream-feeds-links a.rss-feed' ).attr( 'href', response.data.xml_feed );
					$( '.wp-stream-feeds-links a.json-feed' ).attr( 'href', response.data.json_feed );
				}
			}
		});
	});

	$( document ).ready( function() {
		intervals.init( $( '.date-interval' ) );
	});
});

jQuery.extend({
	streamGetQueryVars: function( str ) {
		return (str || document.location.search).replace(/(^\?)/,'').split('&').map(function(n){return n = n.split('='),this[n[0]] = n[1],this;}.bind({}))[0];
	}
});
