# Custom Elements (PHP)

> Verified against Bricks 1.12.3 source (theme path: `.../themes/bricks`) — 2026-07-14.

This skill covers creating custom elements for Bricks Builder.

## Element Architecture

All elements extend the abstract `\Bricks\Element` class and live in `includes/elements/`.

### Element Class Structure

```php
<?php
namespace Bricks;

if ( ! defined( 'ABSPATH' ) ) exit;

class Element_My_Custom extends Element {
    // Required properties
    public $category = 'general';     // Element category in panel
    public $name     = 'my-custom';   // Unique element identifier
    public $icon     = 'ti-star';     // Themify icon class

    // Optional properties
    public $tag          = 'div';         // Default HTML tag
    public $scripts      = [];            // JS dependencies
    public $css_selector = '';            // Default CSS selector for controls
    public $draggable    = true;          // Allow dragging in builder
    public $deprecated   = false;         // Hide from panel if true
    public $nestable     = false;         // Allow child elements

    public function get_label() {
        return esc_html__( 'My Custom Element', 'bricks' );
    }

    public function get_keywords() {
        return [ 'custom', 'my', 'element' ];
    }

    public function set_control_groups() {
        // Define control groups
    }

    public function set_controls() {
        // Define controls
    }

    public function render() {
        // Frontend output
    }

    public static function render_builder() {
        // Builder preview (Vue template)
    }
}
```

## Registering Custom Elements

### Method 1: Filter Hook (only works for files inside the Bricks theme itself)

> ⚠️ **Đã sửa cho đúng 1.12.3** — `Elements::init_elements()` (`includes/elements.php:19-147`) áp dụng filter `bricks/builder/elements`, sau đó với MỖI tên trong mảng, nó tự dựng đường dẫn file cứng là `BRICKS_PATH . "includes/elements/$element_name.php"` (`elements.php:139-147`), với `BRICKS_PATH = get_template_directory()` (`functions.php:13`) — tức là **thư mục theme Bricks gốc**, không phải child theme hay plugin. Nếu chỉ thêm tên vào filter này mà không đặt file thật sự vào `includes/elements/` của theme Bricks, `register_element()` sẽ tự thoát sớm vì `is_readable($file)` false (`elements.php:159-161`) — nghĩa là cách này **không dùng được** để đăng ký element từ child theme/plugin trong bản 1.12.3 này. Vì theme Bricks ở đây là read-only, hãy dùng **Method 2** bên dưới cho custom elements bên ngoài.

```php
add_filter( 'bricks/builder/elements', function( $element_names ) {
    $element_names[] = 'my-custom';
    return $element_names;
} );
// Only works if includes/elements/my-custom.php physically exists inside the Bricks theme folder.
```

### Method 2: Element Class Registration (reliable for child theme / plugin code)

```php
add_action( 'init', function() {
    \Bricks\Elements::register_element( 'path/to/element-my-custom.php' );
}, 11 );
```

## Element Categories

Built-in categories:
- `basic` - Basic elements (heading, text, button, image, video)
- `general` - General elements (divider, icon-box, accordion, tabs, form, etc.)
- `media` - Media elements (image-gallery, audio, carousel, slider)
- `wordpress` - WordPress elements (posts, terms, navigation)
- `single` - Single post elements (post-title, post-content, post-meta)
- `woocommerce` - WooCommerce elements (if active)

### Custom Category

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — filter `bricks/builder/element_categories` không có trong source (`grep -rn "element_categories"` trong `includes/` chỉ khớp comment "Get element name" không liên quan, không có `apply_filters`/`add_filter` nào định nghĩa nó). Trong 1.12.3, `$category` chỉ là một chuỗi tự do gán trực tiếp trên element (`public $category = 'my-category';`) — không cần đăng ký category riêng qua filter. Giữ lại đoạn dưới đây để tham khảo nếu site nâng cấp lên bản có filter này.

```php
add_filter( 'bricks/builder/element_categories', function( $categories ) {
    $categories['my-category'] = [
        'title' => 'My Custom',
        'icon'  => 'ti-package',
    ];
    return $categories;
} );
```

## Control Types

### Basic Controls

```php
public function set_controls() {
    // Text input
    $this->controls['title'] = [
        'tab'         => 'content',
        'label'       => esc_html__( 'Title', 'bricks' ),
        'type'        => 'text',
        'default'     => 'Hello World',
        'placeholder' => 'Enter title...',
    ];

    // Textarea
    $this->controls['description'] = [
        'tab'   => 'content',
        'label' => esc_html__( 'Description', 'bricks' ),
        'type'  => 'textarea',
    ];

    // Number
    $this->controls['count'] = [
        'tab'         => 'content',
        'label'       => esc_html__( 'Count', 'bricks' ),
        'type'        => 'number',
        'min'         => 1,
        'max'         => 100,
        'step'        => 1,
        'default'     => 5,
        'placeholder' => 5,
    ];

    // Number with units (for CSS)
    $this->controls['spacing'] = [
        'tab'   => 'content',
        'label' => esc_html__( 'Spacing', 'bricks' ),
        'type'  => 'number',
        'units' => true, // Enables px, %, em, rem, vw, vh
        'css'   => [
            [
                'property' => 'margin-bottom',
                'selector' => '.item',
            ],
        ],
    ];

    // Checkbox
    $this->controls['showIcon'] = [
        'tab'   => 'content',
        'label' => esc_html__( 'Show icon', 'bricks' ),
        'type'  => 'checkbox',
    ];

    // Select dropdown
    $this->controls['layout'] = [
        'tab'         => 'content',
        'label'       => esc_html__( 'Layout', 'bricks' ),
        'type'        => 'select',
        'options'     => [
            'grid'    => esc_html__( 'Grid', 'bricks' ),
            'list'    => esc_html__( 'List', 'bricks' ),
            'masonry' => 'Masonry',
        ],
        'inline'      => true,
        'placeholder' => esc_html__( 'Grid', 'bricks' ),
    ];

    // Color picker
    $this->controls['primaryColor'] = [
        'tab'   => 'content',
        'label' => esc_html__( 'Primary color', 'bricks' ),
        'type'  => 'color',
        'css'   => [
            [
                'property' => 'color',
                'selector' => '.title',
            ],
        ],
    ];
}
```

### Media Controls

```php
// Image
$this->controls['image'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Image', 'bricks' ),
    'type'  => 'image',
];

// Image gallery
$this->controls['gallery'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Gallery', 'bricks' ),
    'type'  => 'image-gallery',
];

// Icon
$this->controls['icon'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Icon', 'bricks' ),
    'type'  => 'icon',
];

// Video
$this->controls['video'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Video', 'bricks' ),
    'type'  => 'video',
];

// SVG
$this->controls['svg'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'SVG', 'bricks' ),
    'type'  => 'svg',
];
```

### Advanced Controls

```php
// Link
$this->controls['link'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Link', 'bricks' ),
    'type'  => 'link',
];

// Typography (font-family, size, weight, style, line-height, etc.)
$this->controls['typography'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Typography', 'bricks' ),
    'type'  => 'typography',
    'css'   => [
        [
            'property' => 'font',
            'selector' => '.text',
        ],
    ],
];

// Spacing (margin/padding)
$this->controls['itemPadding'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Padding', 'bricks' ),
    'type'  => 'spacing',
    'css'   => [
        [
            'property' => 'padding',
            'selector' => '.item',
        ],
    ],
];

// Border
$this->controls['border'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Border', 'bricks' ),
    'type'  => 'border',
    'css'   => [
        [
            'property' => 'border',
            'selector' => '.item',
        ],
    ],
];

// Box shadow
$this->controls['boxShadow'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Box shadow', 'bricks' ),
    'type'  => 'box-shadow',
    'css'   => [
        [
            'property' => 'box-shadow',
            'selector' => '.item',
        ],
    ],
];

// Background
$this->controls['background'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Background', 'bricks' ),
    'type'  => 'background',
    'css'   => [
        [
            'property' => 'background',
            'selector' => '.wrapper',
        ],
    ],
];

// Query (for loop elements)
$this->controls['query'] = [
    'tab'     => 'content',
    'label'   => esc_html__( 'Query', 'bricks' ),
    'type'    => 'query',
    'popup'   => true,
    'inline'  => true,
];
```

### Control Groups

```php
public function set_control_groups() {
    $this->control_groups['settings'] = [
        'title' => esc_html__( 'Settings', 'bricks' ),
        'tab'   => 'content',
    ];

    $this->control_groups['styling'] = [
        'title' => esc_html__( 'Styling', 'bricks' ),
        'tab'   => 'content',
    ];
}

public function set_controls() {
    $this->controls['option1'] = [
        'tab'   => 'content',
        'group' => 'settings', // Assign to group
        'label' => esc_html__( 'Option 1', 'bricks' ),
        'type'  => 'text',
    ];
}
```

### Conditional Controls

```php
// Show control based on another control's value
$this->controls['customTag'] = [
    'tab'      => 'content',
    'label'    => esc_html__( 'Custom tag', 'bricks' ),
    'type'     => 'text',
    'required' => [ 'tag', '=', 'custom' ], // Only show when tag == 'custom'
];

// Multiple conditions (AND)
$this->controls['advancedOption'] = [
    'tab'      => 'content',
    'label'    => esc_html__( 'Advanced', 'bricks' ),
    'type'     => 'text',
    'required' => [
        [ 'showAdvanced', '=', true ],
        [ 'mode', '!=', 'simple' ],
    ],
];
```

### Separator Control

```php
$this->controls['iconSeparator'] = [
    'tab'   => 'content',
    'label' => esc_html__( 'Icon', 'bricks' ),
    'type'  => 'separator',
];
```

### Repeater Control

```php
$this->controls['items'] = [
    'tab'           => 'content',
    'label'         => esc_html__( 'Items', 'bricks' ),
    'type'          => 'repeater',
    'titleProperty' => 'title', // Property to show in repeater title
    'fields'        => [
        'title' => [
            'label' => esc_html__( 'Title', 'bricks' ),
            'type'  => 'text',
        ],
        'content' => [
            'label' => esc_html__( 'Content', 'bricks' ),
            'type'  => 'textarea',
        ],
        'icon' => [
            'label' => esc_html__( 'Icon', 'bricks' ),
            'type'  => 'icon',
        ],
    ],
    'default'       => [
        [ 'title' => 'Item 1', 'content' => 'Content 1' ],
        [ 'title' => 'Item 2', 'content' => 'Content 2' ],
    ],
];
```

## Rendering Elements

### Basic Render Method

```php
public function render() {
    $settings = $this->settings;

    // Set attributes
    $this->set_attribute( '_root', 'class', 'my-custom-element' );

    if ( ! empty( $settings['layout'] ) ) {
        $this->set_attribute( '_root', 'class', 'layout-' . $settings['layout'] );
    }

    // Build output
    $output = "<{$this->tag} {$this->render_attributes( '_root' )}>";

    if ( isset( $settings['title'] ) ) {
        $output .= '<h3 class="title">' . esc_html( $settings['title'] ) . '</h3>';
    }

    $output .= "</{$this->tag}>";

    echo $output;
}
```

### Working with Dynamic Data

```php
public function render() {
    $settings = $this->settings;

    // Render dynamic data tags
    $title = isset( $settings['title'] )
        ? $this->render_dynamic_data( $settings['title'] )
        : '';

    // Use bricks_render_dynamic_data() for external rendering
    $content = bricks_render_dynamic_data( $settings['content'], get_the_ID(), 'text' );

    echo "<div>{$title}</div>";
}
```

### Working with Links

```php
public function render() {
    $settings = $this->settings;

    if ( ! empty( $settings['link'] ) ) {
        $this->set_link_attributes( 'link', $settings['link'] );
        echo "<a {$this->render_attributes( 'link' )}>Link Text</a>";
    }
}
```

### Rendering Icons

```php
public function render() {
    $settings = $this->settings;

    if ( ! empty( $settings['icon'] ) ) {
        $icon_html = self::render_icon( $settings['icon'] );
        echo $icon_html;
    }
}
```

### Rendering Images

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `$this->render_image()` KHÔNG phải là method có thật trên `\Bricks\Element` (`grep -rn "function render_image"` trong toàn bộ `includes/` không ra kết quả nào). Bricks core tự dựng HTML ảnh thủ công trong từng element (xem `includes/elements/image.php: render()`, dùng `get_normalized_image_settings()`, `wp_get_attachment_image()`, v.v.) chứ không có một helper `render_image()` dùng chung. Nếu cần render ảnh từ settings trong element tùy biến, dùng trực tiếp `wp_get_attachment_image()` / `wp_get_attachment_image_url()` với `$settings['image']['id']` hoặc `['url']`.

```php
public function render() {
    $settings = $this->settings;

    if ( ! empty( $settings['image']['id'] ) ) {
        echo wp_get_attachment_image( $settings['image']['id'], $settings['image']['size'] ?? 'large', false, [ 'class' => 'my-image' ] );
    } elseif ( ! empty( $settings['image']['url'] ) ) {
        echo '<img src="' . esc_url( $settings['image']['url'] ) . '" class="my-image" alt="">';
    }
}
```

## Builder Preview (Vue Template)

```php
public static function render_builder() { ?>
    <script type="text/x-template" id="tmpl-bricks-element-my-custom">
        <div :class="['my-custom-element', settings.layout ? `layout-${settings.layout}` : null]">
            <contenteditable
                tag="h3"
                class="title"
                :name="name"
                controlKey="title"
                :settings="settings"
            />
            <div v-if="settings.showContent" class="content">
                {{ settings.content }}
            </div>
            <icon-svg v-if="settings.icon?.icon" :iconSettings="settings.icon"/>
        </div>
    </script>
    <?php
}
```

## Nestable Elements

For elements that can contain child elements:

```php
class Element_My_Container extends Element {
    public $nestable = true;
    public $vue_component = 'bricks-nestable';

    public function get_nestable_children() {
        return [
            [
                'name'     => 'div',
                'settings' => [
                    '_padding' => [ 'top' => '20px', 'bottom' => '20px' ],
                ],
            ],
        ];
    }

    public function render() {
        $output = "<{$this->tag} {$this->render_attributes( '_root' )}>";

        // Render child elements
        $output .= \Bricks\Frontend::render_children( $this );

        $output .= "</{$this->tag}>";

        echo $output;
    }
}
```

## Query Loop Elements

For elements that loop through posts/terms/users.

> 🔧 **Sửa theo 1.12.3** — `\Bricks\Custom_Render_Element` (`includes/elements/custom-render-element.php`) trong 1.12.3 KHÔNG phải là một base class "cứ override `render()`" đơn giản như ví dụ cũ. Nó chỉ cung cấp các method quản lý state của vòng lặp (`set_bricks_query()`, `start_iteration()`, `set_loop_object()`, `next_iteration()`, `end_iteration()`) và được Bricks core dùng nội bộ cho Carousel/Posts/Related Posts/Woo Products — comment trong source ghi rõ "Used for Carousel, Posts, Related Posts, Woo Products" (`custom-render-element.php:12`). Ngoài ra `\Bricks\Query::render()` có chữ ký `render( $callback, $args, $return_array = false )` — tham số `$args` là **bắt buộc**, không có default (`includes/query.php:1533`), khác với ví dụ cũ gọi `$query->render( function(...) {...} )` thiếu tham số này. Đoạn code dưới đã sửa lại chữ ký cho đúng; nếu chỉ cần lặp qua post đơn giản, cân nhắc dùng `hasLoop` + `query` settings có sẵn của Bricks (xem query-loops.md) thay vì tự viết class PHP.

```php
class Element_My_Posts extends Element {
    public $category = 'wordpress';
    public $name     = 'my-posts';

    public function render() {
        $settings = $this->settings;

        // Setup query
        $query = new \Bricks\Query( $this->element );

        // Render loop (2nd arg $args is required in 1.12.3)
        echo '<div class="posts-wrapper">';

        $query->render(
            function() {
                echo '<div class="post-item">';
                echo '<h3>' . get_the_title( get_the_ID() ) . '</h3>';
                echo '</div>';
            },
            []
        );

        echo '</div>';

        // Destroy query (important!)
        $query->destroy();
    }
}
```

## Enqueuing Scripts

```php
class Element_My_Slider extends Element {
    public $scripts = [ 'bricksSplide' ]; // Built-in script

    public function enqueue_scripts() {
        // Enqueue custom scripts
        wp_enqueue_script(
            'my-slider',
            plugin_dir_url( __FILE__ ) . 'js/slider.js',
            [ 'jquery' ],
            '1.0.0',
            true
        );

        wp_enqueue_style(
            'my-slider',
            plugin_dir_url( __FILE__ ) . 'css/slider.css',
            [],
            '1.0.0'
        );
    }
}
```

## Element Hooks

### Filters

```php
// Modify element controls
add_filter( 'bricks/elements/my-custom/controls', function( $controls ) {
    $controls['newOption'] = [
        'tab'   => 'content',
        'label' => 'New Option',
        'type'  => 'text',
    ];
    return $controls;
} );

// Modify element control groups
add_filter( 'bricks/elements/my-custom/control_groups', function( $groups ) {
    $groups['extra'] = [
        'title' => 'Extra Settings',
        'tab'   => 'content',
    ];
    return $groups;
} );

// Modify element scripts
add_filter( 'bricks/elements/my-custom/scripts', function( $scripts ) {
    $scripts[] = 'bricksIsotope';
    return $scripts;
} );

// Modify rendered element output
// 🔧 Fixed: real hook is 'bricks/element/render', not 'bricks/frontend/render_element'
// (confirmed apply_filters( 'bricks/element/render', $render_element, $this ) in includes/elements/base.php:2620;
// 'bricks/frontend/render_element' does not exist anywhere in the 1.12.3 source)
add_filter( 'bricks/element/render', function( $html, $element ) {
    if ( $element->name === 'my-custom' ) {
        $html = '<div class="wrapper">' . $html . '</div>';
    }
    return $html;
}, 10, 2 );
```

## Complete Element Example

```php
<?php
namespace Bricks;

if ( ! defined( 'ABSPATH' ) ) exit;

class Element_Feature_Box extends Element {
    public $category = 'general';
    public $name     = 'feature-box';
    public $icon     = 'ti-layout-cta-center';
    public $tag      = 'div';

    public function get_label() {
        return esc_html__( 'Feature Box', 'bricks' );
    }

    public function get_keywords() {
        return [ 'feature', 'box', 'card', 'icon' ];
    }

    public function set_control_groups() {
        $this->control_groups['icon'] = [
            'title' => esc_html__( 'Icon', 'bricks' ),
            'tab'   => 'content',
        ];
    }

    public function set_controls() {
        // Title
        $this->controls['title'] = [
            'tab'     => 'content',
            'label'   => esc_html__( 'Title', 'bricks' ),
            'type'    => 'text',
            'default' => 'Feature Title',
        ];

        // Description
        $this->controls['description'] = [
            'tab'     => 'content',
            'label'   => esc_html__( 'Description', 'bricks' ),
            'type'    => 'textarea',
            'default' => 'Feature description goes here.',
        ];

        // Link
        $this->controls['link'] = [
            'tab'   => 'content',
            'label' => esc_html__( 'Link', 'bricks' ),
            'type'  => 'link',
        ];

        // Icon group
        $this->controls['icon'] = [
            'tab'   => 'content',
            'group' => 'icon',
            'label' => esc_html__( 'Icon', 'bricks' ),
            'type'  => 'icon',
        ];

        $this->controls['iconSize'] = [
            'tab'   => 'content',
            'group' => 'icon',
            'label' => esc_html__( 'Size', 'bricks' ),
            'type'  => 'number',
            'units' => true,
            'css'   => [
                [
                    'property' => 'font-size',
                    'selector' => '.icon',
                ],
            ],
        ];

        $this->controls['iconColor'] = [
            'tab'   => 'content',
            'group' => 'icon',
            'label' => esc_html__( 'Color', 'bricks' ),
            'type'  => 'color',
            'css'   => [
                [
                    'property' => 'color',
                    'selector' => '.icon',
                ],
            ],
        ];
    }

    public function render() {
        $settings = $this->settings;

        $this->set_attribute( '_root', 'class', 'feature-box' );

        $output = "<{$this->tag} {$this->render_attributes( '_root' )}>";

        // Icon
        if ( ! empty( $settings['icon'] ) ) {
            $output .= '<div class="icon">' . self::render_icon( $settings['icon'] ) . '</div>';
        }

        // Title
        if ( ! empty( $settings['title'] ) ) {
            $title = $this->render_dynamic_data( $settings['title'] );
            $output .= '<h3 class="title">' . $title . '</h3>';
        }

        // Description
        if ( ! empty( $settings['description'] ) ) {
            $desc = $this->render_dynamic_data( $settings['description'] );
            $output .= '<p class="description">' . $desc . '</p>';
        }

        // Link
        if ( ! empty( $settings['link'] ) ) {
            $this->set_link_attributes( 'link', $settings['link'] );
            $output .= "<a {$this->render_attributes( 'link' )} class=\"feature-link\">Learn More</a>";
        }

        $output .= "</{$this->tag}>";

        echo $output;
    }

    public static function render_builder() { ?>
        <script type="text/x-template" id="tmpl-bricks-element-feature-box">
            <div class="feature-box">
                <div v-if="settings.icon?.icon" class="icon">
                    <icon-svg :iconSettings="settings.icon"/>
                </div>
                <contenteditable
                    tag="h3"
                    class="title"
                    :name="name"
                    controlKey="title"
                    :settings="settings"
                />
                <contenteditable
                    tag="p"
                    class="description"
                    :name="name"
                    controlKey="description"
                    :settings="settings"
                />
            </div>
        </script>
        <?php
    }
}
```

## Best Practices

1. **Namespace**: Always use `namespace Bricks;`
2. **Unique names**: Element `$name` must be unique across all elements
3. **Escape output**: Use `esc_html()`, `esc_attr()`, `wp_kses_post()` appropriately
4. **Dynamic data**: Use `$this->render_dynamic_data()` for user content
5. **Attributes**: Use `$this->set_attribute()` and `$this->render_attributes()`
6. **CSS**: Use the `css` property in controls for automatic style generation
7. **Builder preview**: Provide `render_builder()` for better editing experience
8. **Keywords**: Add relevant keywords for element search
