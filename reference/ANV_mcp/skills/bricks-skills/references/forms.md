# Forms (`form`)

> Verified against Bricks 1.12.3 source (theme path: `.../themes/bricks`) — 2026-07-14, via `includes/elements/form.php` + `includes/integrations/form/`.

The `form` element is a highly extensible component that handles field validation and multiple submission actions.

## Field Types

Fields live in the `fields` repeater. Each field must have a unique `id` (used as placeholders like `{{field-id}}`).

Confirmed real `type` options for a field (`includes/elements/form.php` ~line 156-172): `text`, `email`, `textarea`, `tel`, `number`, `url`, `checkbox`, `select`, `radio`, `file`, `date`/`time` (Flatpickr), `password`, `hidden`, `html`.

| Type | Saved shape | Use |
|---|---|---|
| `text`, `email`, `tel`, `url`, `number`, `password` | `"string"` | Standard HTML5 inputs |
| `textarea` | `"string"` | Multi-line text |
| `select`, `radio`, `checkbox` | `["val1", "val2"]` | Options via `options` repeater |
| `file` | `[attachment_ids]` | File uploads |
| `date`, `time` | `"string"` | Native or Flatpickr |
| `hidden` | `"{dynamic_data}"` | Background context |
| `html` | (no value) | Static HTML block rendered via `wp_kses_post()` (confirmed `form.php:2347-2349`) |
| `submit` | (no value) | The submit button |

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — field type `step` (multi-step form divider) KHÔNG có trong danh sách `type` select ở `form.php`. Không có tính năng multi-step form trong bản này. Giữ lại tham khảo nếu site nâng cấp sau này.

## Form Actions

The `actions` array defines what happens on submit. Settings are flat keys on the element object. Confirmed real action list for 1.12.3 (`includes/integrations/form/actions/` directory + `Integrations\Form\Init::get_available_actions()`): `email`, `redirect`, `registration`, `login`, `lost-password`, `reset-password`, `mailchimp`, `sendgrid`, `save-submission`, `custom`, `unlock-password-protection`.

### `email` (Admin/User Notifications)
- `emailTo`: `admin_email` or `custom`.
- `emailToCustom`: CSV list of emails.
- `emailSubject`, `emailContent`: Supports `{{field-id}}` and `{{all_fields}}`.
- `htmlEmail`: `true` for HTML formatting.

### `redirect`
- `redirect`: URL to redirect to.
- `redirectTimeout`: Delay in ms.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — action `webhook` KHÔNG có trong `includes/integrations/form/actions/` (không có file `webhook.php`, và `webhook`/`webhooks`/`dataTemplate` không xuất hiện ở đâu trong `form.php`). Không thể gửi webhook trực tiếp từ form action trong bản này — dùng action `custom` (`bricks/form/custom_action` hook, xem "Programmatic Hooks" bên dưới) để tự gọi `wp_remote_post()`. Giữ lại đoạn dưới tham khảo nếu site nâng cấp sau này.

### `webhook` (2.x only — see warning above)
- `webhooks`: Array of `{ name, url, contentType, dataTemplate, headers }`.
- `dataTemplate`: e.g., `{ "text": "New lead: {{name}}" }`.

### `registration` / `login`
- `registrationRole`: `subscriber`, `author`, etc. (Administrator/Super Admin excluded as a security precaution — confirmed `form.php` role list filtering.)
- `registrationEmail`, `registrationUserName`: Field IDs (confirmed `form.php:1502-1531`).
- Also confirmed real but not in the old list: `login`, `lost-password`, `reset-password` actions each have their own control group.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — action `create-post` KHÔNG có trong `includes/integrations/form/actions/` (không có file `create-post.php`, và `createPostType`/`createPostMeta` không xuất hiện ở đâu trong `form.php`). Không thể tạo post trực tiếp từ form action trong bản này — dùng action `custom` + hook `bricks/form/custom_action` để tự gọi `wp_insert_post()`. Giữ lại đoạn dưới tham khảo nếu site nâng cấp sau này.

### `create-post` (2.x only — see warning above)
- `createPostType`: CPT slug.
- `createPostStatus`: `draft`, `pending`, `publish`.
- `createPostMeta`: `[ { metaKey, metaValue: "{field-id}" } ]`.

### `save-submission`
- Saves to the `{$wpdb->prefix}bricks_form_submissions` table (confirmed table name references in `includes/admin.php`, e.g. `form_submissions_reset_table()`; the doc's earlier `wp_bricks_form_submissions` name was close but not the exact identifier used in source comments — treat prefix as `$wpdb->prefix`, not literally `wp_`). Viewable in Bricks -> Form Submissions.

## Conditional Fields
Each field in the `fields` repeater can have its own `_conditions` (Logic matching Section/Container conditions).

## Submission Data Shape
```jsonc
{
  "form_id": "abc123",
  "fields": {
    "name":  { "value": "John", "type": "text" },
    "email": { "value": "john@x.com", "type": "email" }
  },
  "ip": "1.2.3.4"
}
```

## Programmatic Hooks

### PHP Validation
```php
add_filter( 'bricks/form/validate', function( $errors, $form ) {
    $fields = $form->get_fields();
    $email  = $fields['email'] ?? '';
    if ( str_ends_with( $email, '@tempmail.com' ) ) {
        $errors[] = 'Disposable emails not allowed.';
    }
    return $errors;
}, 10, 2 );
```

### Custom Action
```php
add_action( 'bricks/form/custom_action', function( $form ) {
    $settings = $form->get_settings();
    $fields   = $form->get_fields();
    // Do something custom
} );
```

## Recipes

**Newsletter with Mailchimp & Redirect:**
```jsonc
"actions": ["mailchimp", "redirect"],
"mailchimpList": "list_id",
"redirect": "/thank-you"
```

**Webhook to Slack (no native `webhook` action in 1.12.3 — use `custom`):**
```php
add_action( 'bricks/form/custom_action', function( $form ) {
    $fields = $form->get_fields();
    wp_remote_post( 'https://hooks.slack.com/services/…', [
        'body' => wp_json_encode( [ 'text' => 'New lead: ' . ( $fields['name']['value'] ?? '' ) ] ),
        'headers' => [ 'Content-Type' => 'application/json' ],
    ] );
} );
```
Set `"actions": ["custom"]` on the form element to trigger this.
