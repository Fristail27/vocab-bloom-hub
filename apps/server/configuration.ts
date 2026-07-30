export default () => ({});

export const checkIsPostgres = () => !!process.env.DATABASE_URL;
