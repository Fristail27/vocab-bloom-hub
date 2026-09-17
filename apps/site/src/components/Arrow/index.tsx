import React from 'react';

import styles from './styles.module.scss';

/** The "more" arrow after a link label: points forward in the writing direction (issue #464) */
export const Arrow = () => <span className={styles.arrow} aria-hidden="true" />;
