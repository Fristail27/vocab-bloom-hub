import clientCookie from 'js-cookie';

export const getClientToken = () => {
  const isAuthorized = clientCookie.get('isAuthorized') === 'true';
  return isAuthorized ? clientCookie.get('bearer') : null;
};
