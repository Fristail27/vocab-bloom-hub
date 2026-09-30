import { redirect } from 'next/navigation';
import { CommonPageP } from '@/types/common';

// The import and the export of a dictionary are actions of a dataset (issue
// #540): they are made from its card on the datasets page. The old address
// stays, for the links that name it.
export default async function MovedToDatasetsPage({ params }: CommonPageP) {
  const { locale } = await params;
  redirect(`/${locale}/managing/datasets`);
}
