interface UserAvatarProps {
  name?: string;
  email: string;
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function UserAvatar({ name, email, size = 'md', imageUrl }: UserAvatarProps) {
  const getInitials = () => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const getColorFromString = (str: string) => {
    const colors = [
      'bg-blue-600',
      'bg-green-600',
      'bg-purple-600',
      'bg-pink-600',
      'bg-yellow-600',
      'bg-indigo-600',
    ];
    const index = str.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div
      className={`${sizeClasses[size]} ${getColorFromString(email)} rounded-full flex items-center justify-center text-white font-semibold`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name || email} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span>{getInitials()}</span>
      )}
    </div>
  );
}
