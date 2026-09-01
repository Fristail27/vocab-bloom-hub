import { Skeleton } from 'antd';

// Pending UI for the server-rendered admin pages (issue #348): navigation
// used to keep the previous screen with no indication at all
export default function Loading() {
  return <Skeleton active title paragraph={{ rows: 8 }} style={{ maxWidth: 860 }} />;
}
