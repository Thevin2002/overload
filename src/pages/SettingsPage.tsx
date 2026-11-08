import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useAuth } from '../data/AuthContext'
import { useFeedback } from '../components/Feedback'
import { Button, Card, Field, PageHeader, SectionTitle, Segmented, Stepper, Toggle } from '../components/ui'
import { clearLocalBackend } from '../data/backend'

export function SettingsPage() {
  const { settings, updateSettings } = useData()
  const { user, signOut } = useAuth()
  const { confirm } = useFeedback()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Settings" back={() => navigate(-1)} />

      <SectionTitle>Units</SectionTitle>
      <Card className="space-y-4">
        <Field label="Weight">
          <Segmented value={settings.weightUnit} onChange={(weightUnit) => updateSettings({ weightUnit })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Field>
        <Field label="Length (waist)">
          <Segmented value={settings.lengthUnit} onChange={(lengthUnit) => updateSettings({ lengthUnit })} options={[{ value: 'in', label: 'inches' }, { value: 'cm', label: 'cm' }]} />
        </Field>
        <p className="text-xs text-ink-500">Data is stored in kg and inches and converted for display, so switching units never changes your history.</p>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card className="space-y-4">
        <Segmented
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Field label="Week starts on">
          <Segmented value={settings.weekStartsOn} onChange={(weekStartsOn) => updateSettings({ weekStartsOn })} options={[{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }]} />
        </Field>
      </Card>

      <SectionTitle>Rest timer</SectionTitle>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default rest (s)">
            <Stepper label="default rest" step={15} min={15} decimal={false} value={settings.restSec} onChange={(v) => updateSettings({ restSec: Math.max(15, v ?? 90) })} />
          </Field>
          <Field label="After superset round (s)">
            <Stepper label="superset rest" step={15} min={15} decimal={false} value={settings.supersetRestSec} onChange={(v) => updateSettings({ supersetRestSec: Math.max(15, v ?? 60) })} />
          </Field>
        </div>
        <Toggle checked={settings.autoStartRest} onChange={(autoStartRest) => updateSettings({ autoStartRest })} label="Start timer when a set is ticked" hint="Vibrates and beeps when rest is over" />
      </Card>

      <SectionTitle>Progression</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight step (kg)">
            <Stepper label="kg step" step={0.5} min={0.5} value={settings.stepKg} onChange={(v) => updateSettings({ stepKg: Math.max(0.25, v ?? 2.5) })} />
          </Field>
          <Field label="Weight step (lb)">
            <Stepper label="lb step" step={1} min={1} value={settings.stepLb} onChange={(v) => updateSettings({ stepLb: Math.max(0.5, v ?? 5) })} />
          </Field>
        </div>
        <p className="text-xs text-ink-500">
          Double progression: when every set reaches the top of its rep range, Overload suggests adding this much and dropping back to the bottom of the range. The step is also used by the +/− buttons.
        </p>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card className="space-y-3">
        <div className="text-sm text-ink-500">{user?.demo ? 'Demo mode — data lives only in this browser.' : `Signed in as ${user?.email ?? user?.name}`}</div>
        <Button variant="secondary" block onClick={() => navigate('/data')}>
          Backup & import
        </Button>
        <Button
          variant="secondary"
          block
          icon="logout"
          onClick={async () => {
            const ok = await confirm({
              title: user?.demo ? 'Leave demo mode?' : 'Sign out?',
              message: user?.demo ? 'Demo data stays in this browser unless you clear it below.' : 'Your data stays safe in your account.',
              confirmLabel: user?.demo ? 'Leave demo' : 'Sign out',
            })
            if (ok) await signOut()
          }}
        >
          {user?.demo ? 'Leave demo mode' : 'Sign out'}
        </Button>
        {user?.demo && (
          <Button
            variant="ghost"
            block
            className="!text-red-600"
            onClick={async () => {
              const ok = await confirm({ title: 'Erase all demo data?', message: 'Everything logged in demo mode on this device is deleted.', confirmLabel: 'Erase', danger: true })
              if (ok) {
                clearLocalBackend('demo')
                await signOut()
              }
            }}
          >
            Erase demo data
          </Button>
        )}
      </Card>
      <p className="mt-6 text-center text-xs text-ink-400">Overload · works offline · your data, your account</p>
    </>
  )
}
