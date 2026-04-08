import { CATEGORY_ICONS } from "@/lib/eonet";
import { HelpCircle } from "lucide-react";

export default function CategoryIcon({
  categoryId,
  className,
  style,
}: {
  categoryId: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = CATEGORY_ICONS[categoryId] || HelpCircle;
  return <Icon className={className} style={style} />;
}
