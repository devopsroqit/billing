import { addDeployment } from "@/app/actions";
import { DEPLOYMENT_ACTIONS, DEPLOYMENT_ACTION_LABELS } from "@/lib/constants";

const today = () => new Date().toISOString().slice(0, 10);

// Record a deployment / movement event for a device.
export function DeploymentForm({ deviceId }: { deviceId: string }) {
  return (
    <form action={addDeployment} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Action</label>
          <select className="input" name="action" defaultValue="DEPLOYED">
            {DEPLOYMENT_ACTIONS.map((a) => <option key={a} value={a}>{DEPLOYMENT_ACTION_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" name="startDate" defaultValue={today()} />
        </div>
        <div>
          <label className="label">Site / location</label>
          <input className="input" name="site" placeholder="e.g. Hyderabad Hub" />
        </div>
        <div>
          <label className="label">Customer / project</label>
          <input className="input" name="customer" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Assigned to</label>
          <input className="input" name="assignedTo" placeholder="person / team" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" name="notes" />
        </div>
      </div>
      <button className="btn-primary" type="submit">Record movement</button>
    </form>
  );
}
