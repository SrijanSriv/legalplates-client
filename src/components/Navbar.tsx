'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Upload, MessageSquare, FolderOpen } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: FileText },
    { href: '/upload', label: 'Upload', icon: Upload },
    { href: '/chat', label: 'Draft', icon: MessageSquare },
    { href: '/templates', label: 'Templates', icon: FolderOpen },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white">
              <FileText className="w-6 h-6 text-blue-400" />
              LegalPlates
            </Link>
          </div>
          <div className="flex space-x-8">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-400 text-white'
                      : 'border-transparent text-gray-300 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

