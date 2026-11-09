// Element conditions. Keys are Conditions::set_options() in includes/conditions.php.
// Outer array is OR. Each inner array is AND. There is no relation field.
// These are not templateConditions. A popup still uses templateConditions.

export const CONDITION_KEYS = [
  'post_id',
  'post_title',
  'post_parent',
  'post_status',
  'post_author',
  'post_date',
  'featured_image',
  'user_logged_in',
  'user_id',
  'user_registered',
  'user_role',
  'weekday',
  'date',
  'time',
  'datetime',
  'woo_product_type',
  'woo_product_sale',
  'woo_product_new',
  'woo_product_stock_status',
  'woo_product_stock_quantity',
  'woo_product_stock_management',
  'woo_product_sold_individually',
  'woo_product_purchased_by_user',
  'woo_product_featured',
  'woo_product_rating',
  'woo_product_category',
  'woo_product_tag',
  'dynamic_data',
  'browser',
  'operating_system',
  'current_url',
  'referer',
];

const KEYS = new Set(CONDITION_KEYS);

// One AND group. Pass several groups only when the plan says OR.
export function conditions(groups) {
  if (!Array.isArray(groups) || !groups.length) throw new Error('conditions needs at least one group');
  return groups.map((group) => {
    if (!Array.isArray(group) || !group.length) throw new Error('a condition group is an AND list');
    return group.map((item) => {
      if (!KEYS.has(item?.key)) throw new Error(`${item?.key} is not a condition key in Bricks 1.12.3`);
      if (item.value == null || item.compare == null) throw new Error(`${item.key} needs compare and value from the plan`);
      const row = { key: item.key, compare: item.compare, value: item.value };
      if (item.key === 'dynamic_data') {
        if (!item.dynamicData) throw new Error('dynamic_data needs dynamicData, the tag');
        row.dynamic_data = item.dynamicData;
      }
      return row;
    });
  });
}
