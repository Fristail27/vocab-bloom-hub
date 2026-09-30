import cookies from 'js-cookie';

// The dataset the admin edits (issue #540), kept while they move between
// pages: a cookie, so the pages rendered on the server read it as well as
// the browser. No cookie is the active dataset — whichever that is.
export const EDITED_DATASET_COOKIE = 'edited_dataset';

const YEAR_DAYS = 365;

/** The dataset the switch names; undefined for the active one */
export const readEditedDataset = (): string | undefined => cookies.get(EDITED_DATASET_COOKIE) || undefined;

/** Keeps the choice; undefined goes back to the active dataset */
export const writeEditedDataset = (name: string | undefined): void => {
  if (name) cookies.set(EDITED_DATASET_COOKIE, name, { path: '/', sameSite: 'lax', expires: YEAR_DAYS });
  else cookies.remove(EDITED_DATASET_COOKIE, { path: '/' });
};
