// Query loops. Key is `query` (includes/query.php). There is no `_query`.
// A static card row is not a loop. Call this only when the plan names a post type.

export function postQuery({ postType, perPage } = {}) {
  const type = String(postType ?? '').trim();
  if (!type) throw new Error('postQuery needs postType from the plan');
  const query = { objectType: 'post', post_type: [type] };
  if (perPage != null) query.posts_per_page = perPage;
  return query;
}

export function postsElement(query) {
  if (!query?.objectType) throw new Error('postsElement needs a query from postQuery');
  return { name: 'posts', settings: { query } };
}
