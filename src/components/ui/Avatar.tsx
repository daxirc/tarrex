interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ 
  src, 
  alt,
  size = 'md' 
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden bg-slate-200`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-purple-100 text-purple-600 font-medium">
          {alt.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}