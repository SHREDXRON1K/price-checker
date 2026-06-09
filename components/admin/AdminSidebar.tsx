export default function AdminSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img
          src="/logomasjid.png"
          alt="Shop Logo"
          style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain" }}
        />
        <div>
          <div className="logo-text">Masjid Indonesia Frankfurt</div>
          <div className="logo-sub">Admin Panel</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-label">Inventory</div>
        <a className="nav-item active" href="/admin">
          <span className="nav-icon">📦</span> Products
        </a>
        <a className="nav-item" href="/api/admin/export">
          <span className="nav-icon">⬇</span> Export CSV
        </a>
        <div className="nav-label">Store</div>
        <a className="nav-item" href="/search" target="_blank">
          <span className="nav-icon">🔍</span> Price Checker
        </a>
      </nav>
      <div className="sidebar-footer">Price Checker v1.0</div>
    </aside>
  );
}
