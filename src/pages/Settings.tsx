import { useState } from "react";

export function Settings() {
  const [threshold, setThreshold] = useState(5);
  const [autoSync, setAutoSync] = useState(true);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); };

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Configuración</p><h2>Operación</h2></div><span className="muted">Preferencias del panel</span></div>
    <div className="settings-grid">
      <label className="setting-card"><span>Alerta de stock bajo</span><strong>Umbral de unidades</strong><input type="number" min="0" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /><small>Se marcarán variantes con {threshold} unidades o menos.</small></label>
      <label className="setting-card"><span>Sincronización</span><strong>Sincronización automática</strong><button className={`toggle ${autoSync ? "on" : ""}`} onClick={() => setAutoSync((value) => !value)}>{autoSync ? "Activada" : "Desactivada"}</button><small>La API será responsable de sincronizar Shopify de forma segura.</small></label>
      <div className="setting-card"><span>Shopify</span><strong>Conexión</strong><div className="status warning">API pendiente</div><small>El token y las credenciales nunca se exponen en este frontend.</small></div>
      <div className="setting-card"><span>Despachos</span><strong>Blue Express</strong><div className="status warning">Pendiente de API</div><small>Preparado para tracking, etiquetas y estados de despacho.</small></div>
    </div>
    <div className="settings-actions"><button className="primary-button" onClick={save}>Guardar configuración</button>{saved && <span className="status ok">Guardado en demo</span>}</div>
  </section>;
}
