import { Handle, Position } from 'reactflow';
import {
  FolderIcon,
  DocumentIcon,
  Squares2X2Icon,
  CubeIcon,
} from '@heroicons/react/24/outline';

const iconClassName = 'h-4 w-4 mr-2 text-on-surface-variant';

const CustomNode = ({ data }: { data: { label: string; type?: string } }) => {
  const { label, type } = data;

  const renderIcon = () => {
    switch (type) {
      case 'folder':
        return <FolderIcon className={iconClassName} />;
      case 'file':
        return <DocumentIcon className={iconClassName} />;
      case 'dependency':
        return <Squares2X2Icon className={iconClassName} />;
      case 'root':
        return <CubeIcon className={iconClassName} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center rounded-md border border-outline bg-surface-2 px-3 py-2 text-sm">
      <Handle type="target" position={Position.Top} />
      {renderIcon()}
      <span className="truncate text-on-surface">{label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomNode;
