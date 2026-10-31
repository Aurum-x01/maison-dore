let renderFn = async () => {};
export const setRenderer = (f) => { renderFn = f; };

export async function navigate(url, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
  await renderFn();
}
export const roleHome = (role) => (role === 'admin' ? '/admin' : role === 'worker' ? '/worker' : '/menu');
