import {
  FolderIcon,
  DocumentIcon,
  Squares2X2Icon,
  CubeIcon,
} from '@heroicons/react/24/outline';

const legendItems = [
  { icon: <FolderIcon className="h-4 w-4" />, label: 'Folder' },
  { icon: <DocumentIcon className="h-4 w-4" />, label: 'File' },
  { icon: <Squares2X2Icon className="h-4 w-4" />, label: 'Dependency' },
  { icon: <CubeIcon className="h-4 w-4" />, label: 'Root Package' },
];

const GraphLegend = () => {
  return (
    <div className="absolute bottom-4 left-4 rounded-md border border-outline bg-surface-2/90 p-3 text-xs text-on-surface">
      <h4 className="mb-2 text-sm font-semibold">Legend</h4>
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2 py-1">
          {item.icon}
          <span className="text-on-surface-variant">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default GraphLegend;
