# Assets & Builder Permissions

> Verified against Bricks 1.12.3 source (theme path: `.../themes/bricks`) — 2026-07-14, via `includes/assets.php`, `includes/assets/files.php`, `includes/capabilities.php`, `includes/cli.php`.

This skill covers the CSS and JavaScript asset generation and optimization system in Bricks Builder.

## Assets Architecture

### Core Files

> 🔧 **Sửa theo 1.12.3** — có 2 class, không phải 1: `\Bricks\Assets` (CSS/JS inline generation từ element settings) và `\Bricks\Assets_Files` (file-based CSS: liệt kê/ghi/regenerate file `.css`, tại `includes/assets/files.php`). Các method "regenerate/get file list" ở mục dưới nằm trên `Assets_Files`, không phải `Assets`.

| File               | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `assets.php`       | `Assets` class — inline CSS/JS generation from element settings |
| `assets/files.php` | `Assets_Files` class — CSS **file** generation, listing, regeneration |

### Asset Types

| Type               | Description                     | Storage                      |
| ------------------ | ------------------------------- | ---------------------------- |
| CSS Files          | Generated from element settings | `wp-content/uploads/bricks/` |
| Theme Styles CSS   | Global theme styles             | Inline or file               |
| Global Classes CSS | Custom CSS classes              | Inline or file               |
| Custom CSS         | Per-page custom CSS             | Inline or file               |
| Scripts            | JavaScript dependencies         | Enqueued or inline           |

## CSS Generation

### Asset Generation Flow

```
Builder Save
    ↓
Extract Element Settings
    ↓
Generate CSS from Settings
    ↓
Save to CSS File (or inline)
    ↓
Frontend Request
    ↓
Load CSS File/Inline
```

### CSS File Naming

```
/wp-content/uploads/bricks/
├── css/
│   ├── post-{post_id}.min.css      // Page CSS
│   ├── template-{template_id}.min.css // Template CSS
│   ├── theme-styles.min.css        // Theme styles
│   └── global-classes.min.css      // Global classes
```

## Asset Settings (Bricks Settings)

### CSS Loading

```php
// Bricks Settings > Performance
$settings = [
    // CSS loading method
    'cssLoading' => 'file', // 'file' or 'inline'
    
    // Disable CSS file generation
    'disableCssFilesGeneration' => false,
    
    // External CSS files
    'externalCssFiles' => false, // Load from CDN-style URL
    
    // Cache CSS files
    'cacheQueryLoops' => true,
];
```

### Script Loading

```php
$settings = [
    // Load scripts in footer
    'scriptsInFooter' => true,
    
    // Disable jQuery
    'disablejQuery' => false,
    
    // Bundle scripts
    'bundleScripts' => false,
];
```

## CSS Generation Hooks

> 🔧 **Sửa theo 1.12.3** — hầu hết các hook dưới đây KHÔNG tồn tại trong source (đã grep toàn bộ `includes/`, 0 kết quả cho từng cái): `bricks/frontend/inline_css`, `bricks/assets/css_file_path`, `bricks/assets/css_file_url`, `bricks/assets/generate_css_files`, `bricks/assets/css_file_generated`, `bricks/assets/before_generate_css_file`. Chỉ 2 hook sau là có thật:
> - `bricks/element/settings` — filter thật, confirmed `apply_filters( 'bricks/element/settings', $this->settings, $this )` tại `includes/elements/base.php:2628`.
> - `bricks/assets/generate_css_from_element` — filter thật, confirmed tại `includes/assets.php:3037` (dùng để bổ sung element cần generate CSS thêm cho loop, không phải để "modify CSS before generation" chung chung).
>
> Giữ lại các hook không xác nhận được bên dưới để tham khảo nếu site nâng cấp lên bản có các hook này.

### Filters

```php
// Modify generated inline CSS
add_filter( 'bricks/frontend/inline_css', function( $css, $post_id ) {
    // Add custom CSS
    $css .= '.my-class { color: red; }';
    return $css;
}, 10, 2 );

// Modify element settings before CSS/HTML generation (confirmed real, base.php:2628)
add_filter( 'bricks/element/settings', function( $settings, $element ) {
    return $settings;
}, 10, 2 );

// Modify CSS file path
add_filter( 'bricks/assets/css_file_path', function( $path, $post_id ) {
    return $path;
}, 10, 2 );

// Modify CSS file URL
add_filter( 'bricks/assets/css_file_url', function( $url, $post_id ) {
    return $url;
}, 10, 2 );

// Control which CSS files to generate
add_filter( 'bricks/assets/generate_css_files', function( $generate, $post_id ) {
    return $generate;
}, 10, 2 );
```

### Actions

```php
// After CSS file generated
add_action( 'bricks/assets/css_file_generated', function( $post_id, $css ) {
    // Clear CDN cache, etc.
}, 10, 2 );

// Before CSS file generation
add_action( 'bricks/assets/before_generate_css_file', function( $post_id ) {
    // Setup before generation
}, 10, 1 );
```

## Regenerate Assets

### Via Admin

Navigate to **Bricks > Settings > Performance** and click "Regenerate CSS files".

### Via WP-CLI

> 🔧 **Sửa theo 1.12.3** — `wp bricks regenerate_assets` (confirmed `includes/cli.php: regenerate_assets()`) KHÔNG nhận flag `--post_id`. Method thật không có tham số nào (`public function regenerate_assets()`), nó luôn regenerate toàn bộ `Assets_Files::get_css_files_list()`. Nếu warning "CSS loading method set to Inline styles" xuất hiện, đổi `cssLoading` sang `file` trước.

```bash
# Regenerate all CSS files (no --post_id flag exists in 1.12.3)
wp bricks regenerate_assets
```

### Programmatically

> 🔧 **Sửa theo 1.12.3** — các method này thực ra nằm trên `\Bricks\Assets_Files` (`includes/assets/files.php`), không phải `\Bricks\Assets`. Không có `generate_css_file( $post_id )` hay `delete_css_file( $post_id )` nào tồn tại; method thật để generate CSS 1 post cần cả `$content_type` và `$elements`.

```php
// Regenerate all CSS files (confirmed includes/assets/files.php:105)
\Bricks\Assets_Files::regenerate_css_files();

// Regenerate a single CSS file entry from the list (confirmed :636)
\Bricks\Assets_Files::regenerate_css_file( $data, $index, true );

// Generate CSS for one post (confirmed :481) — needs content_type + elements, not just $post_id
\Bricks\Assets_Files::generate_post_css_file( $post_id, $content_type, $elements );
```

## Inline CSS Generation

### From Element Settings

```php
// Generate inline CSS from element
$css = \Bricks\Assets::generate_inline_css_from_element( 
    $element,           // Element settings
    $controls,          // Control definitions
    $context = ''       // Context (e.g., 'popup')
);
```

### CSS Property Mapping

Controls with `css` property auto-generate CSS:

```php
$controls['backgroundColor'] = [
    'label' => 'Background',
    'type'  => 'color',
    'css'   => [
        [
            'property' => 'background-color',
            'selector' => '', // Root element
        ],
    ],
];

// Generates: .brxe-{element_id} { background-color: #value; }
```

## Script Enqueuing

### Element Scripts

Elements can specify script dependencies:

```php
class Element_My_Custom extends \Bricks\Element {
    public $scripts = ['swiper', 'gsap'];
    
    public function enqueue_scripts() {
        // Enqueue additional scripts
        wp_enqueue_script( 'my-custom-script', 'path/to/script.js', [], '1.0', true );
    }
}
```

### Available Scripts

| Script Handle | Description       |
| ------------- | ----------------- |
| `swiper`      | Slider library    |
| `gsap`        | Animation library |
| `isotope`     | Masonry/filtering |
| `photoswipe`  | Lightbox          |
| `splide`      | Carousel          |
| `mapbox`      | Mapbox maps       |
| `leaflet`     | Leaflet maps      |
| `google-maps` | Google Maps       |

### Custom Script Dependencies

```php
// Add script dependency
add_filter( 'bricks/element/{element_name}/scripts', function( $scripts ) {
    $scripts[] = 'my-custom-script';
    return $scripts;
} );
```

## Asset Optimization

### Recommended Settings

```php
$optimized_settings = [
    // Load CSS as external file
    'cssLoading' => 'file',
    
    // Enable CSS file generation
    'disableCssFilesGeneration' => false,
    
    // Load scripts in footer
    'scriptsInFooter' => true,
    
    // Cache query loops
    'cacheQueryLoops' => true,
];
```

### Minification

Bricks automatically minifies:
- CSS files (`.min.css`)
- Inline CSS

### Critical CSS

For critical CSS handling:

```php
// Add custom critical CSS
add_action( 'wp_head', function() {
    echo '<style id="critical-css">';
    // Critical styles here
    echo '</style>';
}, 1 );
```

## Asset File Paths

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `\Bricks\Assets::get_css_file_path()`, `get_css_file_url()`, `get_uploads_dir()`, `get_uploads_url()` KHÔNG có trong source (đã grep toàn bộ `includes/assets.php` và `includes/assets/files.php`, không có method nào tên như vậy). File CSS được ghi qua `wp_upload_dir()` trực tiếp trong `Assets_Files` (confirmed `includes/assets.php:121: wp_upload_dir( null, false )`); dùng `wp_upload_dir()['basedir'] . '/bricks/css/'` nếu cần đường dẫn thủ công. Giữ lại đoạn dưới tham khảo nếu site nâng cấp sau này.

```php
// Get CSS file path
$path = \Bricks\Assets::get_css_file_path( $post_id );

// Get CSS file URL
$url = \Bricks\Assets::get_css_file_url( $post_id );

// Get uploads directory
$uploads_dir = \Bricks\Assets::get_uploads_dir();

// Get uploads URL
$uploads_url = \Bricks\Assets::get_uploads_url();
```

### Directory Structure

```
/wp-content/uploads/bricks/
├── css/
│   ├── post-123.min.css
│   ├── template-456.min.css
│   └── ...
├── fonts/
│   └── custom-font.woff2
└── images/
    └── ...
```

## Global Classes CSS

### Generation

```php
// Global classes are stored in options and generate CSS
// bricks_global_classes → CSS

$global_classes = [
    [
        'id'       => 'abc123',
        'name'     => 'my-button',
        'settings' => [
            'backgroundColor' => ['hex' => '#ff0000'],
            '_padding' => ['top' => '10px', 'right' => '20px', ...],
        ],
    ],
];
```

### CSS Output

```css
.my-button {
    background-color: #ff0000;
    padding: 10px 20px 10px 20px;
}
```

## Theme Styles CSS

Theme styles generate CSS for:
- Typography
- Colors
- Buttons
- Forms
- Layout
- Custom element defaults

### Selector Scope

```css
/* Theme styles use body scope */
body .brxe-button { ... }
body .brxe-heading { ... }
```

## Performance Tips

1. **Use CSS file loading**: External files cache better than inline
2. **Enable file generation**: Don't disable unless necessary
3. **Regenerate after changes**: Always regenerate after theme style updates
4. **Minimize custom CSS**: Use controls instead of custom CSS when possible
5. **Lazy load scripts**: Only load scripts needed on each page
6. **Use WP-CLI for bulk**: Regenerate with WP-CLI after migrations
7. **CDN compatibility**: Use external CSS files for CDN caching

## Troubleshooting

### CSS Not Updating

1. Regenerate CSS files in Bricks settings
2. Clear browser cache
3. Clear CDN/caching plugin cache
4. Check file permissions on uploads folder

### CSS File Not Loading

1. Check if CSS file exists in uploads/bricks/css/
2. Verify CSS loading setting is "file"
3. Check for 404 errors in browser console
4. Verify file URL is accessible

### Missing Styles

1. Ensure element has settings that generate CSS
2. Check if control has `css` property defined
3. Verify breakpoint-specific styles are generated
4. Check inline vs file CSS loading mode

---


This skill covers the builder access control and user capabilities system in Bricks Builder.

## Permissions Architecture

### Core Files

> 🔧 **Sửa theo 1.12.3** — `builder-permissions.php` KHÔNG tồn tại (`find` toàn theme không ra file nào tên "permission*" ngoài `capabilities.php`). Toàn bộ logic access control nằm trong `capabilities.php`, được `builder.php` gọi (confirmed `Capabilities::current_user_can_use_builder( $post_id )` tại `includes/builder.php:1118`).

| File                | Purpose                            |
| ------------------- | ---------------------------------- |
| `capabilities.php`  | WordPress capabilities integration + all builder/code/template access checks |
| `builder.php`       | Calls `Capabilities::current_user_can_use_builder()` to gate builder access (line 1118) |

## Access Control Levels

### Builder Access

Who can access the Bricks Builder:

| Setting        | Description                               |
| -------------- | ----------------------------------------- |
| Administrators | WordPress admins always have access       |
| Roles          | Specific user roles can be granted access |
| Capabilities   | Custom capability requirement             |

### Feature Access

What features users can access within the builder:

| Feature         | Description               |
| --------------- | ------------------------- |
| Code Element    | Execute custom code       |
| Code CSS/JS     | Add custom CSS/JavaScript |
| Custom Fonts    | Upload custom fonts       |
| Template Access | Create/edit templates     |
| Theme Styles    | Modify theme styles       |

## Bricks Settings Configuration

### Builder Access (Settings > Builder Access)

```php
// Which roles can access the builder
$settings = [
    // Allow these roles to use the builder
    'builderAccess' => ['administrator', 'editor'],
    
    // Capability required (alternative to roles)
    'builderAccessCapability' => 'edit_pages',
];
```

### Code Execution

```php
$settings = [
    // Who can use code elements
    'codeExecution' => 'administrators', // 'administrators', 'roles', 'disabled'
    
    // Specific roles for code execution (when codeExecution is 'roles')
    'codeExecutionRoles' => ['administrator', 'editor'],
    
    // Disable code execution entirely
    'codeExecutionDisabled' => false,
];
```

## Checking Permissions

### Builder Access

```php
// Check if current user can access builder
$can_edit = \Bricks\Capabilities::current_user_can_use_builder();

// Check for specific post
$can_edit_post = \Bricks\Capabilities::current_user_can_use_builder( $post_id );
```

### Code Execution

```php
// Check if code execution is enabled globally
$code_enabled = \Bricks\Helpers::code_execution_enabled();

// Check if current user can execute code
$can_execute = \Bricks\Capabilities::current_user_has_full_access();
```

### Template Access

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `current_user_can_edit_templates()` và `current_user_can_edit_template( $template_id )` KHÔNG có trên `\Bricks\Capabilities`. Method thật đã confirmed trong `capabilities.php`: `current_user_can_use_builder( $post_id = 0 )` (:335), `current_user_has_full_access()` (:363), `current_user_has_no_access()` (:377), `current_user_can_upload_svg()` (:394), `current_user_can_execute_code()` (:410), `current_user_can_bypass_maintenance_mode()` (:431), `current_user_can_form_submission_access()` (:447). Không có method riêng cho "template access" — dùng `current_user_can_use_builder( $template_id )` (templates cũng là post).

```php
// Check if user can access templates
$can_templates = \Bricks\Capabilities::current_user_can_edit_templates();

// Check specific template
$can_template = \Bricks\Capabilities::current_user_can_edit_template( $template_id );
```

## Custom Capabilities

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — TOÀN BỘ các filter từ đây đến hết mục "Hooks Reference" bên dưới (`bricks/capabilities/builder_access`, `bricks/builder/can_edit`, `bricks/code/execute_code`, `bricks/elements/registered`, `bricks/template/can_edit`, `bricks/global_classes/can_edit`, `bricks/theme_styles/can_edit`, `bricks/code/allowed_functions`) và hằng số `BRICKS_MULTISITE_BUILDER_ACCESS` đều KHÔNG có trong source (đã grep toàn bộ `includes/`, 0 kết quả cho mỗi cái; `capabilities.php` chỉ có 2 filter WP core: `manage_users_columns`, `manage_users_custom_column`). Không có cơ chế filter nào để can thiệp permission theo cách này trong 1.12.3 — quyền được set qua Bricks > Settings > Builder Access (roles/capabilities cố định) và qua `\Bricks\Capabilities::save_builder_capabilities()` / `save_capabilities()`. Giữ lại các đoạn dưới tham khảo nếu site nâng cấp lên bản có các hook này.

### Register Custom Capability

```php
// Add custom capability requirement
add_filter( 'bricks/capabilities/builder_access', function( $capabilities ) {
    $capabilities[] = 'my_custom_capability';
    return $capabilities;
} );

// Grant capability to role
$role = get_role( 'editor' );
$role->add_cap( 'my_custom_capability' );
```

### Override Access Check

```php
// Override builder access check
add_filter( 'bricks/builder/can_edit', function( $can_edit, $post_id, $user_id ) {
    // Custom logic
    if ( get_user_meta( $user_id, 'approved_builder_user', true ) ) {
        return true;
    }
    return $can_edit;
}, 10, 3 );
```

## Per-User Restrictions

### Restrict Code Access

```php
// Disable code execution for specific users
add_filter( 'bricks/code/execute_code', function( $execute, $user_id ) {
    // Disable for user ID 5
    if ( $user_id === 5 ) {
        return false;
    }
    return $execute;
}, 10, 2 );
```

### Restrict Element Access

```php
// Hide certain elements from users
add_filter( 'bricks/elements/registered', function( $elements ) {
    // Only allow code element for administrators
    if ( ! current_user_can( 'administrator' ) ) {
        unset( $elements['code'] );
    }
    return $elements;
} );
```

## Template Permissions

### Per-Template Access

```php
// Restrict template editing
add_filter( 'bricks/template/can_edit', function( $can_edit, $template_id, $user_id ) {
    // Check if user is assigned to this template
    $allowed_users = get_post_meta( $template_id, '_allowed_users', true );
    
    if ( is_array( $allowed_users ) && ! in_array( $user_id, $allowed_users ) ) {
        return false;
    }
    
    return $can_edit;
}, 10, 3 );
```

### Template Type Restrictions

```php
// Restrict header/footer template editing
add_filter( 'bricks/template/can_edit', function( $can_edit, $template_id ) {
    $type = get_post_meta( $template_id, BRICKS_DB_TEMPLATE_TYPE, true );
    
    // Only administrators can edit header/footer
    if ( in_array( $type, ['header', 'footer'] ) && ! current_user_can( 'administrator' ) ) {
        return false;
    }
    
    return $can_edit;
}, 10, 2 );
```

## Global Classes Permissions

```php
// Restrict global class editing
add_filter( 'bricks/global_classes/can_edit', function( $can_edit, $user_id ) {
    // Only administrators can edit global classes
    return current_user_can( 'administrator' );
}, 10, 2 );
```

## Theme Styles Permissions

```php
// Restrict theme styles editing
add_filter( 'bricks/theme_styles/can_edit', function( $can_edit, $user_id ) {
    // Only administrators can edit theme styles
    return current_user_can( 'administrator' );
}, 10, 2 );
```

## Helper Functions

> 🔧 **Sửa theo 1.12.3** — `is_administrator()` và `current_user_can_edit_templates()` không tồn tại (xem cảnh báo phía trên); dùng `current_user_can( 'administrator' )` của WordQuery hoặc kiểm tra role trực tiếp. 3 method còn lại đã confirmed thật.

```php
// Check if user has full access (confirmed capabilities.php:363)
\Bricks\Capabilities::current_user_has_full_access();

// Check builder access for post (confirmed capabilities.php:335)
\Bricks\Capabilities::current_user_can_use_builder( $post_id );

// Check code execution (confirmed helpers.php:1762)
\Bricks\Helpers::code_execution_enabled();
```

## Security Considerations

### Code Execution Security

Code execution should be restricted to trusted users:

```php
// Filter dangerous code patterns
add_filter( 'bricks/code/allowed_functions', function( $functions ) {
    // Remove dangerous functions
    unset( $functions['exec'] );
    unset( $functions['shell_exec'] );
    unset( $functions['system'] );
    return $functions;
} );
```

### Sanitization

All builder input is sanitized:

```php
// Element settings are sanitized on save
// Code is signed and verified before execution
```

## Multisite Permissions

### Network-wide Settings

```php
// In wp-config.php
define( 'BRICKS_MULTISITE_BUILDER_ACCESS', 'super_admin' );
```

### Per-Site Overrides

Each site can have its own builder access settings via Bricks > Settings.

## Hooks Reference

```php
// Builder access check
add_filter( 'bricks/builder/can_edit', function( $can, $post_id, $user_id ) {
    return $can;
}, 10, 3 );

// Code execution check
add_filter( 'bricks/code/execute_code', function( $execute, $user_id ) {
    return $execute;
}, 10, 2 );

// Template access check
add_filter( 'bricks/template/can_edit', function( $can, $template_id, $user_id ) {
    return $can;
}, 10, 3 );

// Global classes access
add_filter( 'bricks/global_classes/can_edit', function( $can, $user_id ) {
    return $can;
}, 10, 2 );

// Theme styles access
add_filter( 'bricks/theme_styles/can_edit', function( $can, $user_id ) {
    return $can;
}, 10, 2 );
```

## Best Practices

1. **Principle of least privilege**: Only grant necessary access
2. **Restrict code execution**: Limit to administrators only
3. **Use role-based access**: Don't rely on individual user permissions
4. **Audit regularly**: Review who has builder access
5. **Test permissions**: Verify restrictions work as expected
6. **Document access levels**: Maintain documentation of who can do what
7. **Use custom capabilities**: For granular control, create custom caps
