import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Reveal({ children, delay = 0, className = "", as = "div" }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </Component>
  );
}

export function PageHeader({ eyebrow, title, highlight, children, className = "" }) {
  return (
    <section className={`brand-shell pt-12 sm:pt-16 ${className}`}>
      {eyebrow && <p className="brand-eyebrow">{eyebrow}</p>}
      <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.02] mt-3 ornament-line">
        {title} {highlight && <span className="gold-gradient-text">{highlight}</span>}
      </h1>
      {children && <div className="mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-[#5F5147]">{children}</div>}
    </section>
  );
}

export function PrimaryLink({ to, href, children, className = "", external = false, icon = true, ...props }) {
  const cls = `focus-brand shine-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-[#D4AF37]/35 bg-[#5B0D18] px-5 py-3 text-sm font-semibold text-[#FFFDF7] shadow-[0_18px_34px_rgba(91,13,24,.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:bg-[#2B1B17] ${className}`;
  const content = <>{children}{icon && <ArrowRight size={17} aria-hidden="true" />}</>;
  if (href) {
    return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls} {...props}>{content}</a>;
  }
  return <Link to={to} className={cls} {...props}>{content}</Link>;
}

export function SecondaryLink({ to, href, children, className = "", external = false, ...props }) {
  const cls = `focus-brand inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-[#5B0D18]/35 bg-[#FFFDF7]/65 px-5 py-3 text-sm font-semibold text-[#5B0D18] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:bg-[#FFFDF7] ${className}`;
  if (href) {
    return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls} {...props}>{children}</a>;
  }
  return <Link to={to} className={cls} {...props}>{children}</Link>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="brand-card rounded-md px-6 py-10 text-center">
      <div className="mx-auto mb-5 h-12 w-12 rounded-full border border-[#D4AF37]/40 bg-[#F7F1E6] shadow-inner" />
      <p className="font-serif-display text-2xl font-semibold text-[#2B1B17]">{title}</p>
      {children && <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#6B5E55]">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProductSkeletonGrid({ count = 4 }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="brand-card rounded-md overflow-hidden">
          <div className="skeleton-shimmer aspect-[4/5]" />
          <div className="space-y-2 p-4">
            <div className="skeleton-shimmer h-4 rounded" />
            <div className="skeleton-shimmer h-3 w-2/3 rounded" />
            <div className="skeleton-shimmer h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
