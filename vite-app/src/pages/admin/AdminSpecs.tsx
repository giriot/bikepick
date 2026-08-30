import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSpecGroups, getSpecDefinitions, saveSpecGroup, saveSpecDefinition } from '../../lib/api';
import type { ScoreKey, SpecDefinition, SpecGroup, SpecDataType } from '../../lib/types';
import { SCORE_CATEGORY_LABELS } from '../../lib/score';
import { Button, Card, Field, Input, LoadingBlock, ErrorBlock, Select } from '../../components/ui';

/**
 * /admin/specs — manage specification groups and specification definitions.
 * These power the dynamic spec system: admins can add unlimited spec names,
 * choose their data type, unit, whether they appear in comparisons, and
 * optionally map them to a CompareBike Score category.
 */
export default function AdminSpecs() {
  const { toast } = useApp();
  const [groups, setGroups] = useState<SpecGroup[]>([]);
  const [defs, setDefs] = useState<SpecDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gName, setGName] = useState('');
  const [sName, setSName] = useState('');
  const [sGroup, setSGroup] = useState('');
  const [sUnit, setSUnit] = useState('');
  const [sType, setSType] = useState<SpecDataType>('text');
  const [sCompare, setSCompare] = useState(true);
  const [sScore, setSScore] = useState<ScoreKey>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, d] = await Promise.all([getSpecGroups(), getSpecDefinitions()]);
      setGroups(g);
      setDefs(d);
      if (!sGroup && g.length) setSGroup(g[0].id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addGroup = async () => {
    if (!gName.trim()) return;
    try {
      await saveSpecGroup(gName.trim());
      toast(`Group "${gName.trim()}" created.`, 'success');
      setGName('');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const addSpec = async () => {
    if (!sName.trim() || !sGroup) return;
    setBusy(true);
    try {
      await saveSpecDefinition({
        group_id: sGroup,
        name: sName.trim(),
        unit: sUnit.trim() || null,
        data_type: sType,
        is_compare: sCompare,
        score_key: sScore,
        sort_order: 999,
        is_active: true,
      });
      toast(`Specification "${sName.trim()}" created — it now appears in bike editors.`, 'success');
      setSName('');
      setSUnit('');
      setSScore(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d: SpecDefinition) => {
    try {
      await saveSpecDefinition({ id: d.id, is_active: !d.is_active });
      toast(d.is_active ? 'Deactivated.' : 'Activated.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Specification System</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-black text-ink-900">1 · Add a group</h2>
          <div className="flex gap-2">
            <Input placeholder="e.g. Lighting" value={gName} onChange={(e) => setGName(e.target.value)} />
            <Button variant="outline" onClick={addGroup}>Add group</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <span key={g.id} className={`rounded-full px-2.5 py-1 text-xs font-bold ${g.is_active ? 'bg-ink-100 text-ink-700' : 'bg-ink-50 text-ink-300 line-through'}`}>
                {g.name}
              </span>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-black text-ink-900">2 · Add a specification</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <Input placeholder="e.g. Headlamp Type" value={sName} onChange={(e) => setSName(e.target.value)} />
            </Field>
            <Field label="Group" required>
              <Select value={sGroup} onChange={(e) => setSGroup(e.target.value)}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
            <Field label="Unit / format">
              <Input placeholder="e.g. mm, Yes/No, kmph" value={sUnit} onChange={(e) => setSUnit(e.target.value)} />
            </Field>
            <Field label="Data type">
              <Select value={sType} onChange={(e) => setSType(e.target.value as SpecDataType)}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Yes / No</option>
              </Select>
            </Field>
            <Field label="Score category (optional)" hint="Used by CompareBike Score.">
              <Select value={sScore || ''} onChange={(e) => setSScore((e.target.value || null) as ScoreKey)}>
                <option value="">Not scored</option>
                {Object.entries(SCORE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Show in comparison">
              <Select value={sCompare ? 'Y' : 'N'} onChange={(e) => setSCompare(e.target.value === 'Y')}>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </Field>
          </div>
          <Button className="mt-4" loading={busy} onClick={addSpec}>Create specification</Button>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-black text-ink-900">All definitions ({defs.length})</h2>
      <div className="card divide-y divide-ink-100">
        {defs.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p className={`text-sm font-bold ${d.is_active ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{d.name}</p>
              <p className="text-xs text-ink-400">
                {d.group_name} · {d.data_type}{d.unit ? ` · ${d.unit}` : ''}{d.score_key ? ` · scores: ${SCORE_CATEGORY_LABELS[d.score_key]}` : ''}{!d.is_compare ? ' · hidden in compare' : ''}
              </p>
            </div>
            <Button size="sm" variant={d.is_active ? 'outline' : 'success'} onClick={() => toggleActive(d)}>
              {d.is_active ? 'Active' : 'Inactive'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
