export const getTitle = (form: string) => {
  const titleText = form.replaceAll('_', ' ');
  return `${titleText[0].toUpperCase()}${titleText.slice(1)}`;
};
