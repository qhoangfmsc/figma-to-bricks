/**
 * Classic editor (toggle editor tabs: Visual, Text, Bricks)
 *
 * @since 1.0
 */
function bricksAdminClassicEditor() {
	var bricksEditor = document.getElementById('bricks-editor')
	var wpEditor = document.getElementById('postdivrich')

	if (!bricksEditor || !wpEditor) {
		return
	}

	// Create "Bricks" button & add to classic editor tabs (next to "Visual", and "Text")
	var bricksButton = document.createElement('button')
	bricksButton.type = 'button'
	bricksButton.id = 'switch-bricks'
	bricksButton.classList.add('wp-switch-editor', 'switch-bricks')
	bricksButton.innerText = window.bricksData.title

	var editorTabs = wpEditor.querySelector('.wp-editor-tabs')

	if (editorTabs) {
		editorTabs.appendChild(bricksButton)
	}

	// Add Bricks editor tab content to DOM
	bricksEditor.after(wpEditor)

	document.addEventListener('click', function (e) {
		// Bricks tab
		if (e.target.id === 'switch-bricks') {
			// Don't trigger WordPress button events
			e.preventDefault()
			e.stopPropagation()

			// Hide WordPress content visual and text editors
			wpEditor.style.display = 'none'
			bricksEditor.style.display = 'block'

			// Toggle editor mode input field value
			document.getElementById('bricks-editor-mode').value = 'bricks'
		}

		// WordPress tab (Visual, Text)
		else if (['content-html', 'content-tmce'].indexOf(e.target.id) !== -1) {
			wpEditor.style.display = 'block'
			bricksEditor.style.display = 'none'

			// Toggle editor mode input field value
			document.getElementById('bricks-editor-mode').value = 'wordpress'
		}
	})

	// Automatically toggle Bricks button if the page is rendered with Bricks and has no post content (@since 1.12)
	if (window.bricksData.renderWithBricks) {
		bricksButton.click()
	}
}

/**
 * Admin import (Bricks settings, Bricks templates, etc.)
 *
 * @since 1.0
 */

function bricksAdminImport() {
	var importForm = document.getElementById('bricks-admin-import-form')
	if (!importForm) {
		return
	}

	var addNewButton = document.querySelector('#wpbody-content .page-title-action')
	if (!addNewButton) {
		return
	}

	var templateTagsButton = document.getElementById('bricks-admin-template-tags')
	if (templateTagsButton) {
		addNewButton.after(templateTagsButton)
	}

	var templateBundlesButton = document.getElementById('bricks-admin-template-bundles')
	if (templateBundlesButton) {
		addNewButton.after(templateBundlesButton)
	}

	var importButton = document.getElementById('bricks-admin-import-action')
	if (importButton) {
		addNewButton.after(importButton)
	}

	var importFormContent = document.getElementById('bricks-admin-import-form-wrapper')

	addNewButton.after(importFormContent)

	var toggleTemplateImporter = document.querySelectorAll('.bricks-admin-import-toggle')

	toggleTemplateImporter.forEach(function (toggle) {
		toggle.addEventListener('click', function () {
			importFormContent.style.display =
				importFormContent.style.display === 'block' ? 'none' : 'block'
		})
	})

	var progressDiv = document.querySelector('#bricks-admin-import-form-wrapper .import-progress')

	importForm.addEventListener('submit', function (event) {
		event.preventDefault()

		// Adds action, nonce and referrer from form hidden fields (@since 1.5.4)
		var formData = new FormData(importForm)
		var files = document.getElementById('bricks_import_files').files

		for (var i = 0; i < files.length; i++) {
			var file = files[i]
			formData.append('files[' + i + ']', file)
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: formData,
			processData: false,
			contentType: false,
			beforeSend: () => {
				importForm.setAttribute('disabled', 'disabled')
				if (progressDiv) {
					progressDiv.classList.add('is-active')
				}
			},
			success: function (res) {
				importForm.removeAttribute('disabled')
				if (progressDiv) {
					progressDiv.classList.remove('is-active')
				}
				location.reload()
			}
		})
	})
}

/**
 * Save license key
 *
 * @since 1.0
 */

function bricksAdminSaveLicenseKey() {
	var licenseKeyForm = document.getElementById('bricks-license-key-form')

	if (!licenseKeyForm) {
		return
	}

	var action = licenseKeyForm.action.value
	var nonce = licenseKeyForm.nonce.value // @since 1.5.4
	var submitButton = licenseKeyForm.querySelector('input[type=submit]')

	licenseKeyForm.addEventListener('submit', function (e) {
		e.preventDefault()

		submitButton.disabled = true

		var licenseKey = licenseKeyForm.license_key.value

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: action,
				licenseKey: licenseKey,
				nonce: nonce
			},
			success: function (response) {
				if (action === 'bricks_deactivate_license') {
					location.reload()
				} else if (action === 'bricks_activate_license') {
					if (response.success) {
						if (response.data.hasOwnProperty('message')) {
							licenseKeyForm.querySelector('.success-message').innerHTML = response.data.message
						}

						setTimeout(() => {
							location.reload()
						}, 1000)
					} else {
						submitButton.disabled = false

						if (response.data.hasOwnProperty('message')) {
							licenseKeyForm.querySelector('.error-message').innerHTML = response.data.message
						}
					}
				}
			}
		})
	})
}

/**
 * Toggle license key (input type: plain text/password)
 *
 * @since 1.3.5
 */
function bricksAdminToggleLicenseKey() {
	var toggleLicenseKeyIcon = document.getElementById('bricks-toggle-license-key')

	if (!toggleLicenseKeyIcon) {
		return
	}

	toggleLicenseKeyIcon.addEventListener('click', function (e) {
		e.preventDefault()

		if (e.target.classList.contains('dashicons-hidden')) {
			e.target.classList.remove('dashicons-hidden')
			e.target.classList.add('dashicons-visibility')
			e.target.previousElementSibling.type = 'text'
		} else {
			e.target.classList.remove('dashicons-visibility')
			e.target.classList.add('dashicons-hidden')
			e.target.previousElementSibling.type = 'password'
		}
	})
}

function bricksAdminSettings() {
	var settingsForm = document.querySelector('#bricks-settings')

	if (!settingsForm) {
		return
	}

	// Toggle tabs
	var settingsTabs = document.querySelectorAll('#bricks-settings-tabs-wrapper a')
	var settingsFormTables = settingsForm.querySelectorAll('table')

	function showTab(tabId) {
		var tabTable = document.getElementById(tabId)

		for (var i = 0; i < settingsFormTables.length; i++) {
			var table = settingsFormTables[i]

			if (table.getAttribute('id') === tabId) {
				table.classList.add('active')
			} else {
				table.classList.remove('active')
			}
		}
	}

	// Switch tabs listener
	for (var i = 0; i < settingsTabs.length; i++) {
		settingsTabs[i].addEventListener('click', function (e) {
			e.preventDefault()

			var tabId = e.target.getAttribute('data-tab-id')

			if (!tabId) {
				return
			}

			location.hash = tabId
			window.scrollTo({ top: 0 })

			for (var i = 0; i < settingsTabs.length; i++) {
				settingsTabs[i].classList.remove('nav-tab-active')
			}

			e.target.classList.add('nav-tab-active')

			showTab(tabId)
		})
	}

	// Check URL for active tab on page load
	var activeTabId = location.hash.replace('#', '')

	if (activeTabId) {
		var activeTab = document.querySelector('[data-tab-id="' + activeTabId + '"]')

		if (activeTab) {
			activeTab.click()
		}
	}

	// Save/reset settings
	var submitWrapper = settingsForm.querySelector('.submit-wrapper')
	var spinner = settingsForm.querySelector('.spinner.saving')

	if (!settingsForm) {
		return
	}

	settingsForm.addEventListener('submit', function (e) {
		e.preventDefault()
	})

	// Save settings
	var saveSettingsButton = settingsForm.querySelector('input[name="save"]')

	if (saveSettingsButton) {
		saveSettingsButton.addEventListener('click', function (e) {
			if (submitWrapper) {
				submitWrapper.remove()
			}

			if (spinner) {
				spinner.classList.add('is-active')
			}

			jQuery.ajax({
				type: 'POST',
				url: bricksData.ajaxUrl,
				data: {
					action: 'bricks_save_settings',
					formData: jQuery(settingsForm).serialize(),
					nonce: window.bricksData.nonce
				},
				success: function (res) {
					// Show save message
					let hash = window.location.hash

					window.location.href = window.location.search += `&bricks_notice=settings_saved${hash}`
				}
			})
		})
	}

	// Reset settings
	var resetSettingsButton = settingsForm.querySelector('input[name="reset"]')

	if (resetSettingsButton) {
		resetSettingsButton.addEventListener('click', function (e) {
			var confirmed = confirm(bricksData.i18n.confirmResetSettings)

			if (!confirmed) {
				return
			}

			if (submitWrapper) {
				submitWrapper.remove()
			}

			if (spinner) {
				spinner.classList.add('is-active')
			}

			jQuery.ajax({
				type: 'POST',
				url: bricksData.ajaxUrl,
				data: {
					action: 'bricks_reset_settings',
					nonce: window.bricksData.nonce
				},
				success: function () {
					// Show reset message
					window.location.href = window.location.search += '&bricks_notice=settings_resetted'
				}
			})
		})
	}

	// Enable/disable code execution
	var enableCodeExecutionCheckbox = settingsForm.querySelector('input[name="executeCodeEnabled"]')
	if (enableCodeExecutionCheckbox) {
		enableCodeExecutionCheckbox.addEventListener('click', function (e) {
			var executeCodeCapabilities = settingsForm.querySelectorAll(
				'input[name^="executeCodeCapabilities"'
			)

			executeCodeCapabilities.forEach(function (checkboxInput) {
				checkboxInput.disabled = !e.target.checked
			})
		})
	}
}

/**
 * Generate CSS files
 *
 * By first getting list of all CSS files that need to be generated.
 * Then generated them one-by-one via individual AJAX calls to avoid any server timeouts.
 */
function bricksAdminGenerateCssFiles() {
	button = document.querySelector('#bricks-css-loading-generate button')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		button.setAttribute('disabled', 'disabled')
		button.classList.add('wait')

		var resultsEl = document.querySelector('#bricks-css-loading-generate .results')

		if (resultsEl) {
			resultsEl.classList.remove('hide')

			var results = resultsEl.querySelector('ul')
			var counter = resultsEl.querySelector('.count')
			var done = resultsEl.querySelector('.done')

			results.innerHTML = ''
			counter.innerHTML = 0

			if (done) {
				done.remove()
			}

			var theEnd = resultsEl.querySelector('.end')

			if (theEnd) {
				theEnd.remove()
			}
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_get_css_files_list',
				nonce: bricksData.nonce
			},
			success: function (res) {
				// Start generating CSS files (index = 0)
				bricksAdminGenerateCssFile(0, results, counter, res.data)
			}
		})
	})
}

/**
 * Code review actions
 *
 * @since 1.9.7
 */
function bricksAdminCodeReview() {
	let viewMode = 'individual'

	// Show all code review items or review individual item
	const reviewCount = document.querySelector('.bricks-code-review-description')
	const showAllButton = document.querySelector('.bricks-code-review-action.show-all')
	const individualButton = document.querySelector('.bricks-code-review-action.individual')
	const codeReviewItems = document.querySelectorAll('.bricks-code-review-item')
	const prevButton = document.querySelector('.bricks-code-review-action.prev')
	const nextButton = document.querySelector('.bricks-code-review-action.next')
	const checkedButtons = document.querySelectorAll('.bricks-code-review-item-check')

	if (!showAllButton || !codeReviewItems || !individualButton) {
		return
	}

	const recalculateTotalReviewed = (count = 'up') => {
		let totalReviewed = document.querySelector('.bricks-code-review-total-reviewed')
		// let totalMarked = document.querySelectorAll('.bricks-code-review-item.item-marked').length
		let totalMarked = totalReviewed.innerText
		totalMarked = totalMarked ? parseInt(totalMarked) : 1

		// Next button
		if (count === 'up') {
			totalMarked++
		}

		// Prev button
		else {
			totalMarked--
		}

		if (totalReviewed) {
			totalReviewed.innerText = totalMarked
		}
	}

	// Show all code review items
	showAllButton.addEventListener('click', function (e) {
		e.preventDefault()

		viewMode = 'all'

		// Hide review count
		reviewCount.classList.add('action-hide')

		// Hide itself
		showAllButton.classList.add('action-hide')

		// Show individual button
		individualButton.classList.remove('action-hide')

		// Hide previous & next buttons
		prevButton.classList.add('action-hide')
		nextButton.classList.add('action-hide')

		// Show all code review items
		codeReviewItems.forEach(function (item) {
			item.classList.remove('item-hide')
		})
	})

	// Show individual code review item
	individualButton.addEventListener('click', function (e) {
		e.preventDefault()

		viewMode = 'individual'

		// Show review count
		reviewCount.classList.remove('action-hide')

		// Hide itself
		individualButton.classList.add('action-hide')

		// Show show all button
		showAllButton.classList.remove('action-hide')

		// Show previous & next buttons
		prevButton.classList.remove('action-hide')
		nextButton.classList.remove('action-hide')

		// Hide all code review items
		codeReviewItems.forEach(function (item) {
			item.classList.add('item-hide')
		})

		// Show the item-current
		let currentItem = document.querySelector('.bricks-code-review-item.item-current')
		if (currentItem) {
			currentItem.classList.remove('item-hide')
		}
	})

	// Show previous code review item
	prevButton.addEventListener('click', function (e) {
		e.preventDefault()

		let currentItem = document.querySelector('.bricks-code-review-item.item-current')
		let previousItem = currentItem.previousElementSibling

		if (previousItem) {
			currentItem.classList.remove('item-current')
			currentItem.classList.add('item-hide')
			previousItem.classList.add('item-current')
			previousItem.classList.remove('item-hide')

			recalculateTotalReviewed('down')
		}
	})

	// Show next code review item
	nextButton.addEventListener('click', function (e) {
		e.preventDefault()

		let currentItem = document.querySelector('.bricks-code-review-item.item-current')
		let nextItem = currentItem.nextElementSibling

		if (nextItem) {
			currentItem.classList.remove('item-current')
			currentItem.classList.add('item-hide')
			nextItem.classList.add('item-current')
			nextItem.classList.remove('item-hide')

			recalculateTotalReviewed('up')
		}
	})

	// Mark the code review item as checked
	if (checkedButtons.length) {
		checkedButtons.forEach(function (button) {
			button.addEventListener('click', function (e) {
				e.preventDefault()

				let item = button.closest('.bricks-code-review-item')

				if (item) {
					item.classList.add('item-marked')
					recalculateTotalReviewed()

					// Go to next item
					if (viewMode === 'individual') {
						setTimeout(() => {
							nextButton.click()
						}, 400)
					}
				}
			})
		})
	}
}

/**
 * Regenerate Bricks CSS files for modified default breakpoint width
 *
 * @since 1.5.1
 */
function bricksAdminBreakpointsRegenerateCssFiles() {
	let button = document.getElementById('breakpoints-regenerate-css-files')

	if (!button) {
		return
	}

	let checkIcon = button.querySelector('i')

	button.addEventListener('click', function (e) {
		e.preventDefault()

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_regenerate_bricks_css_files',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
				checkIcon.classList.add('hide')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')
				checkIcon.classList.remove('hide')
			}
		})
	})
}

function bricksAdminGenerateCssFile(index, results, counter, data) {
	return jQuery
		.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_regenerate_css_file',
				data: data[index],
				index: index
			},
			success: function (res) {
				var fileName = res.data.hasOwnProperty('file_name') ? res.data.file_name : false

				if (fileName) {
					var html = ''
					var count = counter ? parseInt(counter.innerText) : 0

					if (Array.isArray(fileName)) {
						fileName.forEach(function (fileName) {
							html += '<li>' + fileName + '</li>'
							count++
						})
					} else {
						html += '<li>' + fileName + '</li>'
						count++
					}

					if (!res.success) {
						html = html.replace('<li>', '<li class="error">')
					}

					if (results) {
						results.insertAdjacentHTML('afterbegin', html)
					}

					if (counter) {
						counter.innerText = count
					}
				}
			}
		})
		.then(function (res) {
			// Finished processing all entries
			if (index === data.length) {
				var button = document.querySelector('#bricks-css-loading-generate button')

				button.removeAttribute('disabled')
				button.classList.remove('wait')

				var infoText = document.querySelector('#bricks-css-loading-generate .info')

				if (infoText) {
					infoText.remove()
				}

				if (results) {
					results.insertAdjacentHTML('beforebegin', '<div class="done">... THE END :)</div>')
				}
			}

			// Continue with next entry
			else {
				bricksAdminGenerateCssFile(index + 1, results, counter, data)
			}
		})
}

/**
 * Run Converter
 *
 * @since 1.4:   Convert 'bricks-element-' ID & class name prefix to 'brxe-'
 * @since 1.5: Convert elements to nestable elements
 */
function bricksAdminRunConverter() {
	var button = document.getElementById('bricks-run-converter')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		let data = {
			action: 'bricks_get_converter_items',
			nonce: bricksData.nonce,
			convert: []
		}

		if (document.getElementById('convert_element_ids_classes').checked) {
			data.convert.push('elementClasses')
		}

		if (document.getElementById('convert_container').checked) {
			data.convert.push('container')
		}

		// @since 1.5.1 to add position: relative as needed
		if (document.getElementById('add_position_relative').checked) {
			data.convert.push('addPositionRelative')
		}

		// @since 1.6 to convert entry animation ('_animation') to interactions
		if (document.getElementById('entry_animation_to_interaction').checked) {
			data.convert.push('entryAnimationToInteraction')
		}

		if (!data.convert.length) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data,
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: (res) => {
				console.info('bricks_get_converter_items', res.data)

				// Start running converter (index = 0)
				let index = 0
				let data = res.data.items
				let convert = res.data.convert

				bricksAdminConvert(index, data, convert)
			}
		})
	})
}

function bricksAdminConvert(index, data, convert) {
	return jQuery.ajax({
		type: 'POST',
		url: bricksData.ajaxUrl,
		data: {
			action: 'bricks_run_converter',
			nonce: bricksData.nonce,
			data: data[index],
			convert: convert
		},
		success: function (res) {
			var button = document.getElementById('bricks-run-converter')
			var resultsEl = button.parentNode.querySelector('.results')

			// Add results HTML (div.results > ul)
			if (!resultsEl) {
				resultsEl = document.createElement('div')
				resultsEl.classList.add('results')

				var resultsList = document.createElement('ul')
				resultsEl.appendChild(resultsList)

				button.parentNode.appendChild(resultsEl)
			}

			// Re-run converter: Clear results
			else if (resultsEl && index === 0) {
				resultsEl.querySelector('ul').innerHTML = ''
			}

			var label = res.data.hasOwnProperty('label') ? res.data.label : false

			// Add converted item as list item (<li>)
			if (label) {
				var resultItem = document.createElement('li')
				resultItem.innerHTML = label

				resultsEl.querySelector('ul').prepend(resultItem)
			}

			console.warn('run_converter', index, label, res.data)

			// Finished processing all entries
			if (index === data.length) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				var resultItem = document.createElement('li')
				resultItem.classList.add('done')
				resultItem.innerText = '... THE END :)'

				resultsEl.querySelector('ul').prepend(resultItem)
			}

			// Continue with next entry
			else {
				bricksAdminConvert(index + 1, data, convert)
			}
		}
	})
}

/**
 * Copy template shortcode to clipboard
 */
function bricksTemplateShortcodeCopyToClipboard() {
	var copyToClipboardElements = document.querySelectorAll('.bricks-copy-to-clipboard')

	if (!copyToClipboardElements) {
		return
	}

	copyToClipboardElements.forEach(function (element) {
		element.addEventListener('click', function (e) {
			if (navigator.clipboard) {
				if (!window.isSecureContext) {
					alert('Clipboard API rejected: Not in secure context (HTTPS)')
					return
				}

				// Return: Don't copy if already copied (prevents double-click issue)
				if (element.classList.contains('copied')) {
					e.preventDefault()
					return
				}

				var content = element.value
				var message = element.getAttribute('data-success')

				navigator.clipboard.writeText(content)

				element.value = message
				element.classList.add('copied')

				setTimeout(function () {
					element.value = content
					element.classList.remove('copied')
				}, 2000)
			}
		})
	})
}

/**
 * Dismiss HTTPS notice
 *
 * Timeout required to ensure the node is added to the DOM.
 *
 * @since 1.8.4
 */
function bricksDismissHttpsNotice() {
	setTimeout(() => {
		let dismissButton = document.querySelector('.brxe-https-notice .notice-dismiss')

		if (dismissButton) {
			dismissButton.addEventListener('click', function () {
				jQuery.ajax({
					type: 'POST',
					url: bricksData.ajaxUrl,
					data: {
						action: 'bricks_dismiss_https_notice',
						nonce: bricksData.nonce
					}
				})
			})
		}
	}, 400)
}

/**
 * Delete form submissions table
 *
 * @since 1.9.2
 */
function bricksDropFormSubmissionsTable() {
	let button = document.getElementById('bricks-drop-form-db')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmDropFormSubmissionsTable)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_form_submissions_drop_table',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				alert(res.data.message)
				location.reload()
			}
		})
	})
}

/**
 * Reset form submissions entries
 *
 * @since 1.9.2
 */
function bricksResetFormSubmissionsTable() {
	let button = document.getElementById('bricks-reset-form-db')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmResetFormSubmissionsTable)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_form_submissions_reset_table',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				alert(res.data.message)
				location.reload()
			}
		})
	})
}

/**
 * Delete all submissions of spefic form (ID)
 *
 * @since 1.9.2
 */
function bricksDeleteFormSubmissionsByFormId() {
	// Return: Not on "Form submissions" page
	if (!document.body.classList.contains('bricks_page_bricks-form-submissions')) {
		return
	}

	let deleteButtons = document.querySelectorAll('.column-actions [data-form-id]')

	for (var i = 0; i < deleteButtons.length; i++) {
		let button = deleteButtons[i]
		button.addEventListener('click', function (e) {
			e.preventDefault()

			let formId = button.getAttribute('data-form-id')

			var confirmed = confirm(
				bricksData.i18n.confirmResetFormSubmissionsFormId.replace('[form_id]', `"${formId}"`)
			)

			if (!confirmed) {
				return
			}

			jQuery.ajax({
				type: 'POST',
				url: bricksData.ajaxUrl,
				data: {
					action: 'bricks_form_submissions_delete_form_id',
					nonce: bricksData.nonce,
					formId: formId
				},
				beforeSend: () => {
					button.setAttribute('disabled', 'disabled')
					button.classList.add('wait')
				},
				success: function (res) {
					button.removeAttribute('disabled')
					button.classList.remove('wait')

					alert(res.data.message)
					location.reload()
				}
			})
		})
	}
}

/**
 * Dismiss Instagram access token admin notice
 *
 * Timeout required to ensure the node is added to the DOM.
 *
 * @since 1.9.1
 */
function bricksDismissInstagramAccessTokenNotice() {
	setTimeout(() => {
		let dismissButton = document.querySelector('.brxe-instagram-token-notice .notice-dismiss')

		if (dismissButton) {
			dismissButton.addEventListener('click', function () {
				jQuery.ajax({
					type: 'POST',
					url: bricksData.ajaxUrl,
					data: {
						action: 'bricks_dismiss_instagram_access_token_notice',
						nonce: bricksData.nonce
					}
				})
			})
		}
	}, 400)
}

/**
 * Remote templates URLs: Add button logic
 *
 * @since 1.9.4
 */
function bricksRemoteTemplateUrls() {
	let addMoreButton = document.getElementById('add-remote-template-button')

	if (!addMoreButton) {
		return
	}

	addMoreButton.addEventListener('click', function (e) {
		e.preventDefault()

		// Get last remote template wrapper to clone it for new remote template
		let remoteTemplateWrappers = document.querySelectorAll('.remote-template-wrapper')
		let remoteTemplateWrapper = remoteTemplateWrappers[remoteTemplateWrappers.length - 1]

		if (!remoteTemplateWrapper) {
			return
		}

		let clone = remoteTemplateWrapper.cloneNode(true)
		let labels = clone.querySelectorAll('label')
		labels.forEach((label) => {
			// Replace 'remoteTemplates[index]' 'for' attribute with new index
			label.setAttribute(
				'for',
				label.getAttribute('for').replace(/\[(\d+)\]/, function (match, index) {
					return '[' + (parseInt(index) + 1) + ']'
				})
			)
		})

		let inputs = clone.querySelectorAll('input')

		inputs.forEach((input) => {
			// Clear URL input value
			input.value = ''

			// Replace 'remoteTemplates[index]' 'name' attribute with new index
			input.name = input.name.replace(/\[(\d+)\]/, function (match, index) {
				return '[' + (parseInt(index) + 1) + ']'
			})

			// Replace 'remoteTemplates[index]' 'id' attribute with new index
			input.id = input.id.replace(/\[(\d+)\]/, function (match, index) {
				return '[' + (parseInt(index) + 1) + ']'
			})
		})

		// Insert clone after last remote template wrapper
		remoteTemplateWrapper.after(clone)
	})
}

/**
 * Delete my template screenshots
 *
 * @since 1.10
 */
function bricksDeleteTemplateScreenshots() {
	let button = document.getElementById('delete-template-screenshots-button')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmDeleteTemplateScreenshots)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_delete_template_screenshots',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				alert(res.data.message)

				if (res.success) {
					location.reload()
				}
			}
		})
	})
}

/**
 * Reindex filters
 *
 * @since 1.9.6
 */
function bricksReindexFilters() {
	let button = document.getElementById('bricks-reindex-filters')
	let progressText = document.querySelector('.indexer-progress')
	let indexButton = document.getElementById('bricks-run-index-job')

	if (!button || !progressText || !indexButton) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmReindexFilters)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_reindex_query_filters',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				if (res.success) {
					progressText.innerText = res.data.message
					setTimeout(() => {
						// Trigger indexerObserver to start checking progress after a short delay
						indexButton.setAttribute('data-no-confirm', 'true')
						indexButton.click()
					}, 500)
				} else {
					console.error('bricks_reindex_query_filters:error', res.data)
				}
			}
		})
	})
}

/**
 * Run query filter index job
 *
 * @since 1.10
 */
function bricksRunIndexJob() {
	let button = document.getElementById('bricks-run-index-job')
	let progressText = document.querySelector('.indexer-progress')
	let checkIcon = button ? button.querySelector('i') : false

	let removeJobsDiv = document.getElementById('bricks-remove-jobs-wrapper')
	let removeJobsButton = document.getElementById('bricks-remove-index-jobs')
	let queryFiltersTd = document.getElementById('bricks-query-filter-td')
	let halted = false // Flag to stop observer

	if (!button || !progressText || !checkIcon || !removeJobsButton || !removeJobsDiv) {
		return
	}

	// Check progress every 3 seconds: Trigger background indexer manually instead of waiting for WP Cron
	const IndexerObserver = () => {
		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_run_index_job',
				nonce: bricksData.nonce
			},
			success: function (res) {
				let progress = res?.data?.progress || false
				let pending = res?.data?.pending || false

				if (progressText && progress) {
					progressText.innerHTML = progress
				}

				if (pending == 0 || halted) {
					button.removeAttribute('disabled')
					button.classList.remove('wait')
					checkIcon.classList.remove('hide')
					if (halted && pending > 0) {
						removeJobsDiv.classList.remove('hide')
					}
				} else {
					// Wait for 3 seconds and check again
					setTimeout(() => {
						IndexerObserver()
					}, 3000)
				}
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
				removeJobsDiv.classList.add('hide')
			}
		})
	}

	let isRunning = button.classList.contains('wait')
	if (isRunning) {
		// Initial load page detected indexer is running, then start observer
		IndexerObserver()
	}

	// Continue index job button
	button.addEventListener('click', function (e) {
		e.preventDefault()

		// Check if no-confirm attribute is set (from reindex filters)
		let noConfirm = button.getAttribute('data-no-confirm')

		if (!noConfirm) {
			var confirmed = confirm(bricksData.i18n.confirmTriggerIndexJob)

			if (!confirmed) {
				return
			}
		}

		IndexerObserver()

		// Always reset no-confirm attribute
		button.removeAttribute('data-no-confirm')
		checkIcon.classList.add('hide')

		// Always hide remove jobs div
		removeJobsDiv.classList.add('hide')
	})

	// Remove all index jobs button (only visible if indexer is not running)
	removeJobsButton.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmRemoveAllIndexJobs)

		if (!confirmed) {
			return
		}

		halted = true // Stop observer for indexer

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_remove_all_index_jobs',
				nonce: bricksData.nonce
			},
			success: function (res) {
				if (res.success) {
					// Wait for 10 seconds and reload the page, give some time for the running indexer to stop
					setTimeout(() => {
						alert(res.data.message)
						location.reload()
					}, 10000)
				}
			},
			beforeSend: () => {
				removeJobsButton.setAttribute('disabled', 'disabled')
				removeJobsButton.classList.add('wait')
				queryFiltersTd.classList.add('blocking')

				let infoDiv = document.createElement('div')
				infoDiv.classList.add('blocking-info-wrapper')
				infoDiv.innerHTML = `<p class="message info">${bricksData.i18n.removingIndexJobsInfo}</p>`

				queryFiltersTd.appendChild(infoDiv)
			}
		})
	})
}

/**
 * Fix filter element database
 *
 * @since 1.12.2
 */
function bricksFixElementDB() {
	let button = document.getElementById('bricks-fix-filter-element-db')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmFixElementDB)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_fix_filter_element_db',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				alert(res.data.message)
				location.reload()
			}
		})
	})
}

/**
 * Regenerate code element & codeEditor signatures
 *
 * @since 1.9.7
 */
function bricksRegenerateCodeSignatures() {
	let button = document.getElementById('bricks-regenerate-code-signatures')

	if (!button) {
		return
	}

	button.addEventListener('click', function (e) {
		e.preventDefault()

		var confirmed = confirm(bricksData.i18n.confirmRegenerateCodeSignatures)

		if (!confirmed) {
			return
		}

		jQuery.ajax({
			type: 'POST',
			url: bricksData.ajaxUrl,
			data: {
				action: 'bricks_regenerate_code_signatures',
				nonce: bricksData.nonce
			},
			beforeSend: () => {
				button.setAttribute('disabled', 'disabled')
				button.classList.add('wait')
			},
			success: function (res) {
				button.removeAttribute('disabled')
				button.classList.remove('wait')

				alert(res.data.message)

				if (res.success) {
					location.reload()
				} else {
					console.error('bricks_regenerate_code_element_signatures:error', res.data)
				}
			}
		})
	})
}

/**
 * Code review filter
 *
 * @since 1.9.7
 */
function bricksAdminCodeReviewFilter() {
	let filterSelect = document.getElementById('code-review-filter')

	if (!filterSelect) {
		return
	}

	filterSelect.addEventListener('change', (e) => {
		let url = new URL(window.location.href)
		url.searchParams.set('code-review', e.target.value)
		window.location.href = url.toString()
	})
}

/**
 * Maintenance mode: Toggle visibility of render header/footer checkboxes
 *
 * @since 1.9.9
 */
function bricksAdminMaintenanceTemplateListener() {
	let maintenanceTemplateSelect = document.getElementById('maintenance-template')
	let renderFooterWrapper = document
		.getElementById('maintenanceRenderFooter')
		?.closest('.setting-wrapper')
	let renderHeaderWrapper = document
		.getElementById('maintenanceRenderHeader')
		?.closest('.setting-wrapper')

	if (!maintenanceTemplateSelect || !renderFooterWrapper || !renderHeaderWrapper) {
		return
	}

	function toggleRenderOptions() {
		let selectedValue = maintenanceTemplateSelect.value
		if (selectedValue === '') {
			renderFooterWrapper.style.display = 'none'
			renderHeaderWrapper.style.display = 'none'
		} else {
			renderFooterWrapper.style.display = 'block'
			renderHeaderWrapper.style.display = 'block'
		}
	}

	// Initial check
	toggleRenderOptions()

	// Add event listener
	maintenanceTemplateSelect.addEventListener('change', toggleRenderOptions)
}

/**
 * Adds a 'scroll' class to thumbnail anchors if the image inside is taller than the anchor.
 * This function ensures that the scroll animation is only applied to images that are
 * visually taller than their container.
 *
 * NOTE: We didn't use @keyframes as we need a dynamic duration and to only scroll when the image is taller than the thumbnail.
 *
 * @since 1.10
 */
function bricksTemplateThumbnailAddScrollAnimation() {
	const thumbnails = document.querySelectorAll('.template_thumbnail a')

	thumbnails.forEach((thumbnail) => {
		const img = thumbnail.querySelector('img')

		/**
		 * Checks the computed height of the image and the thumbnail anchor.
		 * Adds the 'scroll' class to the thumbnail anchor if the image height
		 * is greater than the thumbnail height, and sets up the scroll event listeners.
		 */
		function checkImageHeight() {
			const imgHeight = img.getBoundingClientRect().height
			const thumbnailHeight = thumbnail.getBoundingClientRect().height

			if (imgHeight > thumbnailHeight) {
				const scrollAmount = thumbnailHeight - imgHeight
				const duration = calculateScrollDuration(scrollAmount)

				thumbnail.classList.add('scroll')

				thumbnail.addEventListener('mouseenter', () => {
					startScrollAnimation(img, 0, scrollAmount, duration)
				})

				thumbnail.addEventListener('mouseleave', () => {
					const currentTop = parseFloat(img.style.top) || scrollAmount
					startScrollAnimation(img, currentTop, 0, duration)
				})
			}
		}

		/**
		 * Calculates the scroll duration based on the scroll amount.
		 *
		 * @param {number} scrollAmount - The amount to scroll.
		 * @returns {number} - The calculated duration in milliseconds.
		 */
		function calculateScrollDuration(scrollAmount) {
			const baseDuration = 2000 // Base duration in milliseconds for a significant scroll
			const maxScrollAmount = 200 // Define a max scroll amount for reference
			return (Math.abs(scrollAmount) * baseDuration) / maxScrollAmount
		}

		/**
		 * Animates the image's top property to create a smooth scrolling effect.
		 *
		 * @param {HTMLElement} img - The image element to scroll.
		 * @param {number} startTop - The initial top position.
		 * @param {number} endTop - The final top position.
		 * @param {number} duration - The duration of the scroll animation in milliseconds.
		 */
		function startScrollAnimation(img, startTop, endTop, duration) {
			let animationFrame
			let start

			function scroll(timestamp) {
				if (!start) start = timestamp // Initialize start time
				const elapsed = timestamp - start // Calculate elapsed time
				const progress = Math.min(elapsed / duration, 1) // Calculate progress

				// Update the image's top position based on progress
				img.style.top = startTop + (endTop - startTop) * progress + 'px'

				// Continue the animation if it's not finished
				if (progress < 1) {
					animationFrame = requestAnimationFrame(scroll)
				}
			}

			cancelAnimationFrame(animationFrame) // Cancel any ongoing animation
			animationFrame = requestAnimationFrame(scroll) // Start a new animation
		}

		// Check the image height after it has loaded
		img.addEventListener('load', checkImageHeight)

		// For cached images that might load instantly, check the height immediately
		if (img.complete) {
			checkImageHeight()
		}
	})
}

/**
 * Toggle visibility of WordPress auth URL redirect page dropdown
 *
 * @since 1.11
 */
function bricksAdminAuthUrlBehaviorListener() {
	let behaviorSelect = document.getElementById('wp_auth_url_behavior')
	let redirectPageWrapper = document.getElementById('wp_auth_url_redirect_page_wrapper')

	if (!behaviorSelect || !redirectPageWrapper) {
		return
	}

	function toggleRedirectPageOption() {
		if (behaviorSelect.value === 'custom') {
			redirectPageWrapper.style.display = 'block'
		} else {
			redirectPageWrapper.style.display = 'none'
		}
	}

	// Initial check
	toggleRedirectPageOption()

	// Add event listener
	behaviorSelect.addEventListener('change', toggleRedirectPageOption)
}

/* WooCommerce settings
 *
 * @since 1.11
 */
function bricksAdminWooSettings() {
	let ajaxErrorSelect = document.getElementById('woocommerceAjaxErrorAction')
	let ajaxErrorActionDiv = document.getElementById('wooAjaxErrorScrollToNotice')

	if (ajaxErrorSelect && ajaxErrorActionDiv) {
		// Hide/show the scroll to notice div based on the selected option
		ajaxErrorSelect.addEventListener('change', function (e) {
			if (e.target.value === 'notice') {
				ajaxErrorActionDiv.classList.remove('hide')
			} else {
				ajaxErrorActionDiv.classList.add('hide')
			}
		})
	}
}

/**
 * Template exclusion multiselect handler
 *
 * @since 1.12.2
 */
function bricksAdminTemplateExclusion() {
	const select = document.getElementById('excludedTemplates')
	const wrapper = select?.parentElement

	if (!select || !wrapper) {
		return
	}

	// Create custom control wrapper
	const control = document.createElement('div')
	control.setAttribute('data-control', 'select')
	control.className = 'multiple bricks-multiselect'
	control.setAttribute('tabindex', '0')

	// Create input display area
	const input = document.createElement('div')
	input.className = 'input'

	// Create options wrapper
	const optionsWrapper = document.createElement('div')
	optionsWrapper.className = 'options-wrapper'

	// Create search input
	const searchWrapper = document.createElement('div')
	searchWrapper.className = 'searchable-wrapper'
	searchWrapper.innerHTML = `
		<input class="searchable" type="text" spellcheck="false" placeholder="${
			window.bricksData?.i18n?.searchTemplates || 'Add / Search for ..'
		}">
	`

	// Create dropdown list
	const dropdown = document.createElement('ul')
	dropdown.className = 'dropdown'

	// Add options to dropdown
	Array.from(select.options).forEach((option, index) => {
		const li = document.createElement('li')
		li.setAttribute('data-index', index)
		li.className = option.selected ? 'selected' : ''
		li.innerHTML = `<span>${option.text}</span>`
		dropdown.appendChild(li)
	})

	// Build structure
	optionsWrapper.appendChild(searchWrapper)
	optionsWrapper.appendChild(dropdown)
	control.appendChild(input)
	control.appendChild(optionsWrapper)

	// Hide original select
	select.style.display = 'none'
	select.after(control)

	// Update selected items display
	const updateSelection = () => {
		input.innerHTML = ''
		input.className = 'input'

		const selected = Array.from(select.selectedOptions)

		if (selected.length) {
			input.classList.add('has-value')

			selected.forEach((option) => {
				const value = document.createElement('span')
				value.className = 'value'
				value.setAttribute('data-template-id', option.value)
				value.innerHTML = `
					${option.text}
					<span class="dashicons dashicons-no-alt" data-name="close-box"></span>
				`
				input.appendChild(value)
			})
		} else {
			input.innerHTML = `
				<span class="placeholder">${
					window.bricksData?.i18n?.selectTemplates || 'Select templates...'
				}</span>
				<span class="dashicons dashicons-arrow-down"></span>
			`
		}
	}

	// Initial selection
	updateSelection()

	// Toggle dropdown
	control.addEventListener('click', (e) => {
		const isSearchInput = e.target.classList.contains('searchable')
		if (!isSearchInput) {
			control.classList.toggle('open')
		}
	})

	// Handle option selection
	dropdown.addEventListener('click', (e) => {
		const li = e.target.closest('li')
		if (li) {
			const index = li.dataset.index
			const option = select.options[index]
			option.selected = !option.selected
			li.classList.toggle('selected')
			updateSelection()
		}
	})

	// Handle remove tag click
	input.addEventListener('click', (e) => {
		const closeBox = e.target.closest('[data-name="close-box"]')
		if (closeBox) {
			e.stopPropagation()
			const tag = closeBox.closest('.value')
			const templateId = tag.getAttribute('data-template-id')
			const option = select.querySelector(`option[value="${templateId}"]`)
			if (option) {
				option.selected = false
				dropdown
					.querySelector(`li[data-index="${Array.from(select.options).indexOf(option)}"]`)
					.classList.remove('selected')
				updateSelection()
			}
		}
	})

	// Handle search
	const searchInput = searchWrapper.querySelector('.searchable')
	searchInput.addEventListener('input', (e) => {
		const search = e.target.value.toLowerCase()
		Array.from(dropdown.children).forEach((li) => {
			const text = li.textContent.toLowerCase()
			li.style.display = text.includes(search) ? '' : 'none'
		})
	})

	// Close dropdown when clicking outside
	document.addEventListener('click', (e) => {
		if (!control.contains(e.target)) {
			control.classList.remove('open')
		}
	})
}

document.addEventListener('DOMContentLoaded', function (e) {
	bricksAdminClassicEditor()
	bricksAdminImport()
	bricksAdminSaveLicenseKey()
	bricksAdminToggleLicenseKey()
	bricksAdminSettings()
	bricksAdminRunConverter()
	bricksAdminBreakpointsRegenerateCssFiles()
	bricksAdminGenerateCssFiles()
	bricksAdminCodeReview()
	bricksAdminCodeReviewFilter()

	bricksTemplateShortcodeCopyToClipboard()

	bricksDismissHttpsNotice()
	bricksDismissInstagramAccessTokenNotice()

	bricksDropFormSubmissionsTable()
	bricksResetFormSubmissionsTable()
	bricksDeleteFormSubmissionsByFormId()

	bricksRemoteTemplateUrls()
	bricksDeleteTemplateScreenshots()

	bricksReindexFilters()
	bricksRunIndexJob()
	bricksFixElementDB()

	bricksRegenerateCodeSignatures()

	bricksTemplateThumbnailAddScrollAnimation()

	bricksAdminMaintenanceTemplateListener()
	bricksAdminAuthUrlBehaviorListener()
	bricksAdminWooSettings()

	bricksAdminTemplateExclusion()

	// Move table navigation top & bottom outside of table container to make table horizontal scrollable
	let tableContainer = document.querySelector('.wp-list-table-container')
	let tablenavTop = document.querySelector('.tablenav.top')
	let tablenavBottom = document.querySelector('.tablenav.bottom')

	if (tableContainer && tablenavTop) {
		// Insert tablenav top before table
		tableContainer.parentNode.insertBefore(tablenavTop, tableContainer)
	}

	if (tableContainer && tablenavBottom) {
		// Insert tablenav top before table
		tableContainer.parentNode.insertBefore(tablenavBottom, tableContainer.nextSibling)
	}

	// Set search_box placeholder
	let formSubmissionsForm = document.getElementById('bricks-form-submissions')
	let searchBox = formSubmissionsForm
		? formSubmissionsForm.querySelector('.search-box input[type=search]')
		: false
	if (searchBox) {
		searchBox.placeholder = window.bricksData?.i18n.formSubmissionsSearchPlaceholder
	}
})
