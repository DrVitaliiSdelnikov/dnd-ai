export const onRequest = (ctx: any) => {
  ctx.request.url.includes('/api/')
  if (ctx.request.url.includes('/api/')) return ctx.next();
  return;
};
