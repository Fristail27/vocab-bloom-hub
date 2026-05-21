import { cookies } from 'next/headers';

export const getServerToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get('bearer')?.value;
};
