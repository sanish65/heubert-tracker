// The heading row every tab opens with: eyebrow, title, subtitle, actions on the right.
export default function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
