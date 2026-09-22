import React from 'react';

import type { JsonLdT } from '@/core/structuredData';

/**
 * The JSON-LD script of a page (issue #480). `<` is escaped in the JSON: a
 * headword or a definition is data, and `</script>` inside it must not end
 * the element
 */
export const JsonLd = ({ data }: { data: JsonLdT | JsonLdT[] }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
  />
);
