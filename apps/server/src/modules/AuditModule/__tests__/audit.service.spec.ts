import { ConfigurationError } from '../../../../configuration';
import { DEFAULT_AUDIT_RETENTION_DAYS, getAuditRetentionDays } from '../audit.service';

describe('getAuditRetentionDays (AUDIT_RETENTION_DAYS, issue #334)', () => {
  it('defaults to 90 days when unset or blank', () => {
    expect(getAuditRetentionDays({})).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: '  ' })).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
  });

  it('accepts whole days and 0 for keep-forever', () => {
    expect(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: '30' })).toBe(30);
    expect(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: '0' })).toBe(0);
  });

  it('fails startup on anything else, like the other duration variables', () => {
    for (const raw of ['-1', '1.5', 'month', '']) {
      if (raw === '') continue;
      expect(() => getAuditRetentionDays({ AUDIT_RETENTION_DAYS: raw })).toThrow(ConfigurationError);
    }
  });
});
