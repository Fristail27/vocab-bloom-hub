import { cookies } from 'next/headers';
import { EDITED_DATASET_COOKIE } from '@/components/EditedDataset/cookie';

export const getServerToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get('bearer')?.value;
};

// the dataset the switch of the admin UI names (issue #540): its cookie travels with the page request
export const getServerDataset = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(EDITED_DATASET_COOKIE)?.value || undefined;
};
