export const onRequest: any = async (ctx: any) => {
  if (ctx.request.url.includes('/api/')) {
    return await ctx.next();
  }

  return await ctx.next();
};
