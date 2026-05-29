function SectionHeader({ title, subtitle, aside }) {
  return (
    <div className="section-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export default SectionHeader;
