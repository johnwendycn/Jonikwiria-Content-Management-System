import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform
} from 'react-native';

const API_BASE = 'http://localhost:5000/api/audit-logs';

// ─── Severity Config ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  CRITICAL: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'CRITICAL', dot: '#EF4444' },
  ERROR:    { color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'ERROR',    dot: '#F97316' },
  WARN:     { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',  label: 'WARN',     dot: '#EAB308' },
  INFO:     { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', label: 'INFO',     dot: '#60A5FA' },
  DEBUG:    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', label: 'DEBUG',    dot: '#9CA3AF' }
};

const EVENT_TYPE_COLOR = {
  AUTH:           '#818CF8',
  USER:           '#34D399',
  ROLE:           '#FBBF24',
  PERMISSION:     '#F472B6',
  ACCESS_CONTROL: '#22D3EE',
  SYSTEM:         '#94A3B8',
  DATA:           '#A78BFA'
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const SeverityBadge = ({ severity }) => {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.dot }} />
      <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{cfg.label}</Text>
    </View>
  );
};

const EventTypeBadge = ({ eventType }) => {
  const color = EVENT_TYPE_COLOR[eventType] || '#94A3B8';
  return (
    <View style={{ backgroundColor: `${color}18`, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{eventType}</Text>
    </View>
  );
};

const StatCard = ({ label, value, color, bg }) => (
  <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
};

const truncate = (str, len = 40) => {
  if (!str) return '—';
  return str.length > len ? str.substring(0, len) + '…' : str;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AuditLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 20;

  // Filters
  const [search, setSearch] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterEventType, filterSeverity, filterSuccess]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams({
        page,
        limit: LIMIT,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterEventType) params.set('event_type', filterEventType);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterSuccess !== '') params.set('success', filterSuccess);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.auditLogs);
        setTotalPages(json.data.totalPages);
        setTotalItems(json.data.totalItems);
      } else {
        setErrorMsg(json.message || 'Failed to fetch audit logs.');
      }
    } catch (err) {
      setErrorMsg('Cannot connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterEventType, filterSeverity, filterSuccess]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.warn('Stats fetch failed:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleExport = () => {
    if (Platform.OS !== 'web') return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFilterChip = (label, value, current, setter) => (
    <TouchableOpacity
      key={value}
      style={[styles.chip, current === value && styles.chipActive]}
      onPress={() => setter(current === value ? '' : value)}
    >
      <Text style={[styles.chipText, current === value && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderRow = (item) => {
    const isExpanded = expandedRow === item.id;
    const severityCfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.INFO;
    const isError = !item.success;

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[styles.tableRow, isExpanded && styles.tableRowExpanded, isError && styles.tableRowError]}
          onPress={() => setExpandedRow(isExpanded ? null : item.id)}
          activeOpacity={0.8}
        >
          {/* Severity indicator bar */}
          <View style={[styles.severityBar, { backgroundColor: severityCfg.dot }]} />

          <View style={styles.rowContent}>
            <View style={styles.rowMainLine}>
              <Text style={styles.rowAction} numberOfLines={1}>{item.action || '—'}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <SeverityBadge severity={item.severity} />
                <EventTypeBadge eventType={item.event_type} />
              </View>
            </View>

            <View style={styles.rowMetaLine}>
              <Text style={styles.rowMeta} numberOfLines={1}>
                👤 {item.actor_email || item.actor_display_name || 'Anonymous'}
              </Text>
              <Text style={styles.rowMeta}>
                {item.http_method} {truncate(item.http_path, 35)}
              </Text>
              <Text style={[styles.rowMeta, { color: item.http_status >= 400 ? '#F87171' : '#94A3B8' }]}>
                {item.http_status ? `HTTP ${item.http_status}` : ''}
                {item.duration_ms ? ` · ${item.duration_ms}ms` : ''}
              </Text>
              <Text style={[styles.rowTimestamp]}>{formatDate(item.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.expandArrow}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedPanel}>
            <View style={styles.expandedGrid}>
              <View style={styles.expandedCol}>
                <Text style={styles.expandedLabel}>Event ID</Text>
                <Text style={styles.expandedValue} selectable>{item.id}</Text>
              </View>
              <View style={styles.expandedCol}>
                <Text style={styles.expandedLabel}>Actor IP</Text>
                <Text style={styles.expandedValue}>{item.actor_ip || '—'}</Text>
              </View>
              <View style={styles.expandedCol}>
                <Text style={styles.expandedLabel}>Resource</Text>
                <Text style={styles.expandedValue}>{item.resource_type || '—'} {item.resource_id ? `· ${item.resource_id.substring(0, 8)}…` : ''}</Text>
              </View>
              <View style={styles.expandedCol}>
                <Text style={styles.expandedLabel}>Success</Text>
                <Text style={[styles.expandedValue, { color: item.success ? '#34D399' : '#F87171', fontWeight: '700' }]}>
                  {item.success ? '✓ YES' : '✗ NO'}
                </Text>
              </View>
            </View>

            {item.actor_user_agent ? (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedLabel}>User Agent</Text>
                <Text style={styles.expandedValue} numberOfLines={2}>{item.actor_user_agent}</Text>
              </View>
            ) : null}

            {item.error_message ? (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedLabel}>Error</Text>
                <Text style={[styles.expandedValue, { color: '#F87171' }]}>{item.error_message}</Text>
              </View>
            ) : null}

            {item.metadata ? (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedLabel}>Metadata</Text>
                <View style={styles.jsonBlock}>
                  <Text style={styles.jsonText} selectable>
                    {JSON.stringify(item.metadata, null, 2)}
                  </Text>
                </View>
              </View>
            ) : null}

            {item.changes_after ? (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedLabel}>Request Body Snapshot</Text>
                <View style={styles.jsonBlock}>
                  <Text style={styles.jsonText} selectable>
                    {JSON.stringify(item.changes_after, null, 2)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .chip-btn { transition: all 0.18s ease; }
          .chip-btn:hover { opacity: 0.85; }
          .audit-row { transition: background 0.15s ease; }
          .audit-row:hover { background: rgba(99,102,241,0.04) !important; }
          .audit-export-btn { transition: all 0.2s ease; }
          .audit-export-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        `}} />
      )}

      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>🛡️ Audit Logs</Text>
          <Text style={styles.pageBreadcrumb}>Home / Audit Logs · {totalItems.toLocaleString()} total entries</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => { fetchLogs(); fetchStats(); }}
          >
            <Text style={styles.refreshBtnText}>↺ Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="audit-export-btn"
            style={styles.exportBtn}
            onPress={handleExport}
          >
            <Text style={styles.exportBtnText}>⬇ Export JSON</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Immutability Notice */}
      <View style={styles.immutableNotice}>
        <Text style={styles.immutableText}>
          🔒 Audit logs are <Text style={{ color: '#EF4444', fontWeight: '700' }}>immutable</Text>. No user — including Super Admins — can modify, delete, or alter any record. This is enforced at database, ORM, and API layers simultaneously.
        </Text>
      </View>

      {/* Stats Row */}
      {!statsLoading && stats ? (
        <View style={styles.statsRow}>
          <StatCard label="Total Events" value={stats.totalCount?.toLocaleString()} color="#818CF8" />
          <StatCard label="CRITICAL" value={stats.bySeverity?.CRITICAL || 0} color="#EF4444" />
          <StatCard label="ERROR" value={stats.bySeverity?.ERROR || 0} color="#F97316" />
          <StatCard label="WARN" value={stats.bySeverity?.WARN || 0} color="#EAB308" />
          <StatCard label="Failures" value={stats.failureCount?.toLocaleString()} color="#F87171" />
          <StatCard label="AUTH Events" value={stats.byEventType?.AUTH || 0} color="#34D399" />
        </View>
      ) : (
        <View style={styles.statsRow}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.statCard, { opacity: 0.4 }]}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ))}
        </View>
      )}

      {/* Search + Filter Bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by action, actor, path, IP…"
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#9CA3AF', fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={[styles.filterToggleBtnText, showFilters && { color: '#818CF8' }]}>
            ⚙ Filters {filterEventType || filterSeverity || filterSuccess ? '●' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Event Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['AUTH', 'USER', 'ROLE', 'PERMISSION', 'ACCESS_CONTROL', 'SYSTEM', 'DATA'].map(t =>
                  renderFilterChip(t, t, filterEventType, setFilterEventType)
                )}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Severity</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['CRITICAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map(s =>
                renderFilterChip(s, s, filterSeverity, setFilterSeverity)
              )}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {renderFilterChip('✓ Success', 'true', filterSuccess, setFilterSuccess)}
              {renderFilterChip('✗ Failure', 'false', filterSuccess, setFilterSuccess)}
            </View>
          </View>

          {(filterEventType || filterSeverity || filterSuccess) ? (
            <TouchableOpacity onPress={() => { setFilterEventType(''); setFilterSeverity(''); setFilterSuccess(''); }}>
              <Text style={{ color: '#F87171', fontSize: 12, marginTop: 8 }}>✕ Clear all filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 3 }]}>ACTION · ACTOR · PATH</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>SEVERITY</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TYPE</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>TIMESTAMP</Text>
      </View>

      {/* Error */}
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {errorMsg}</Text>
        </View>
      ) : null}

      {/* Table Body */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ color: '#94A3B8', marginTop: 12 }}>Loading audit trail…</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No audit logs found</Text>
          <Text style={styles.emptySubtitle}>Start using the system and events will appear here automatically.</Text>
        </View>
      ) : (
        <View style={styles.table}>
          {logs.map(renderRow)}
        </View>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <Text style={styles.pageBtnText}>← Prev</Text>
          </TouchableOpacity>

          <Text style={styles.pageInfo}>Page {page} of {totalPages} · {totalItems.toLocaleString()} entries</Text>

          <TouchableOpacity
            style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <Text style={styles.pageBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  content: { padding: 20 },

  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16, flexWrap: 'wrap', gap: 12
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  pageBreadcrumb: { fontSize: 12.5, color: '#64748B' },

  refreshBtn: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF'
  },
  refreshBtnText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  exportBtn: {
    backgroundColor: '#4F46E5', borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 7
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  immutableNotice: {
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 8, padding: 12, marginBottom: 16
  },
  immutableText: { fontSize: 12.5, color: '#92400E', lineHeight: 18 },

  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20
  },
  statCard: {
    flex: 1, minWidth: 100, backgroundColor: '#FFFFFF', borderRadius: 8,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2
  },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  filterBar: {
    flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center'
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    paddingHorizontal: 12, height: 40, gap: 8
  },
  searchIcon: { fontSize: 14, color: '#94A3B8' },
  searchInput: {
    flex: 1, fontSize: 13.5, color: '#1E293B', height: '100%', outlineStyle: 'none'
  },
  filterToggleBtn: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 8, paddingHorizontal: 14, height: 40, justifyContent: 'center'
  },
  filterToggleBtnActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.05)' },
  filterToggleBtnText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  filtersPanel: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 16, marginBottom: 16
  },
  filterGroup: { marginBottom: 14 },
  filterGroupLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0'
  },
  chipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#F8FAFC', borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#E2E8F0', marginBottom: 0
  },
  tableHeaderCell: {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.7
  },

  table: {
    backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },

  tableRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF'
  },
  tableRowExpanded: { backgroundColor: 'rgba(99,102,241,0.03)' },
  tableRowError: { backgroundColor: 'rgba(239,68,68,0.03)' },
  severityBar: { width: 3, minHeight: 60 },
  rowContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  rowMainLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6, flexWrap: 'wrap', gap: 6
  },
  rowAction: {
    fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1
  },
  rowMetaLine: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center'
  },
  rowMeta: { fontSize: 11, color: '#94A3B8' },
  rowTimestamp: { fontSize: 11, color: '#94A3B8', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  expandArrow: { color: '#CBD5E1', fontSize: 10, paddingHorizontal: 12, alignSelf: 'center' },

  expandedPanel: {
    backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    padding: 16
  },
  expandedGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12
  },
  expandedCol: { minWidth: 180 },
  expandedSection: { marginTop: 12 },
  expandedLabel: {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4
  },
  expandedValue: { fontSize: 12.5, color: '#334155' },

  jsonBlock: {
    backgroundColor: '#0F172A', borderRadius: 8, padding: 12, marginTop: 4,
    maxHeight: 200
  },
  jsonText: {
    fontSize: 11, color: '#94A3B8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 18
  },

  loadingBox: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  emptyBox: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 48,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0'
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  errorBox: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: 12, marginBottom: 12
  },
  errorText: { color: '#DC2626', fontSize: 13 },

  pagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingVertical: 8
  },
  pageBtn: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  pageInfo: { fontSize: 13, color: '#94A3B8' }
});
