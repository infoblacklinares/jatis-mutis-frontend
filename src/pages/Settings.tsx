import { useEffect, useState } from "react";
import { logActivity, readSettings, saveSettings } from "../services/localStore";
import { getOrders } from "../services/api";

export function Settings() {
  const current = readSettings();
  const [threshold, setThreshold] = useState(current.stockThreshold);
  const [autoSync, setAutoSync] = useState(current.autoSync);
  const [saved, setSaved] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<"checking" | "connected" | "error">("checking");

  useEffect(() => {
    getOrders().then(() => setShopifyStatus("connected")).catch(() => setShopifyStatus("error"));
  }, []);

  const save = () => {
    const value = { stockThreshold: Math.max(0, threshold), autoSync };
    saveSettings(value);
    logActivity("Configuración actualizada", `Umbral de stock: ${value.stockThreshold} · Sincronización automática: ${value.autoSync ? "activada" : "desactivada"}`);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Configuración</p><h2>Operación</h2></div><span className="muted">Preferencias del panel</span></div>
    <div className="settings-grid">
      <label className="setting-card"><span>Inventario</span><strong>Alerta de stock bajo</strong><input type="number" min="0" value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))} /><small>Se marcarán variantes con {threshold} unidades o menos.</small></label>
      <div className="setting-card"><span>Sincronización</span><strong>Sincronización automática</strong><button type="button" className={`toggle ${autoSync ? "on" : ""}`} onClick={() => setAutoSync((value) => !value)}>{autoSync ? "Activada" : "Desactivada"}</button><small>Controla la preferencia de sincronización del panel.</small></div>
      <div className="setting-card"><span>Shopify</span><strong>Conexión</strong><div className={`status ${shopifyStatus === "connected" ? "ok" : "warning"}`}>{shopifyStatus === "checking" ? "Comprobando..." : shopifyStatus === "connected" ? "Conectado" : "Sin conexión"}</div><small>La conexión utiliza la sesión segura de Shopify y las credenciales permanecen en el servidor.</small></div>
      <div className="setting-card"><span>Despachos</span><strong>Integración externa</strong><div className="status warning">No configurada</div><small>Las integraciones de transporte quedan fuera hasta su aprobación.</small></div>
    </div>
    <div className="settings-actions"><button className="primary-button" onClick={save}>Guardar configuración</button>{saved && <span className="status ok">Configuración guardada</span>}</div>
  </section>;
}
