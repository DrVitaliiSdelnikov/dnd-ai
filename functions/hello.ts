export const onRequestGet = () => {
  return Response.json({ message: '👋 Привет из бэка Cloudflare!' });
};

export const onRequestPost = async ({ request }: any) => {
  // @ts-ignore
  const body = await request.json<{ name: string }>();
  return Response.json({ message: `Hi, ${body.name}!` });
};
