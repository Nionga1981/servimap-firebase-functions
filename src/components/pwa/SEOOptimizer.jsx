import React, { useEffect } from 'react';
import { Search, Globe, Share2, FileText } from 'lucide-react';

const SEOOptimizer = () => {
  useEffect(() => {
    optimizeSEO();
    generateStructuredData();
    optimizeOpenGraph();
    setupCanonicalUrls();
    generateSitemap();
    optimizeForSearchEngines();
  }, []);

  const optimizeSEO = () => {
    // Set page title
    updatePageTitle();
    
    // Set meta descriptions
    setMetaDescription();
    
    // Set meta keywords
    setMetaKeywords();
    
    // Set robots meta
    setRobotsMeta();
    
    // Set viewport meta
    setViewportMeta();
    
    // Set theme color
    setThemeColor();
    
    // Add PWA meta tags
    setPWAMetaTags();
    
    // Add social media tags
    setSocialMediaTags();
  };

  const updatePageTitle = () => {
    const baseTitle = 'ServiMap - Servicios a domicilio en México';
    const currentPath = window.location.pathname;
    
    const titleMap = {
      '/': baseTitle,
      '/search': 'Buscar Servicios | ' + baseTitle,
      '/messages': 'Mensajes | ' + baseTitle,
      '/wallet': 'Mi Wallet | ' + baseTitle,
      '/profile': 'Mi Perfil | ' + baseTitle,
      '/services': 'Servicios Disponibles | ' + baseTitle,
      '/community': 'Comunidad | ' + baseTitle,
      '/help': 'Ayuda y Soporte | ' + baseTitle
    };
    
    document.title = titleMap[currentPath] || baseTitle;
  };

  const setMetaDescription = () => {
    const descriptions = {
      '/': 'Encuentra profesionales confiables para servicios a domicilio en México. Plomería, electricidad, limpieza y más. Pagos seguros y chat en tiempo real.',
      '/search': 'Busca entre miles de profesionales verificados cerca de ti. Compara precios, lee reseñas y contrata servicios a domicilio de manera segura.',
      '/services': 'Explora todos los servicios disponibles en ServiMap: plomería, electricidad, carpintería, limpieza, jardinería y más de 50 categorías.',
      '/wallet': 'Gestiona tu dinero de forma segura con ServiMap Wallet. Realiza pagos, recibe dinero y obtén cashback en todos tus servicios.',
      '/community': 'Únete a la comunidad ServiMap. Conecta con profesionales y clientes, comparte experiencias y encuentra oportunidades.'
    };
    
    const currentPath = window.location.pathname;
    const description = descriptions[currentPath] || descriptions['/'];
    
    setMetaTag('description', description);
  };

  const setMetaKeywords = () => {
    const keywords = [
      'servicios a domicilio',
      'profesionales México',
      'plomero',
      'electricista',
      'carpintero',
      'limpieza',
      'jardinería',
      'reparaciones',
      'mantenimiento hogar',
      'servicios confiables',
      'ServiMap',
      'app servicios'
    ];
    
    setMetaTag('keywords', keywords.join(', '));
  };

  const setRobotsMeta = () => {
    // Allow indexing for public pages
    const publicPaths = ['/', '/search', '/services', '/community', '/help'];
    const currentPath = window.location.pathname;
    
    if (publicPaths.includes(currentPath)) {
      setMetaTag('robots', 'index, follow, max-image-preview:large');
    } else {
      setMetaTag('robots', 'noindex, follow');
    }
  };

  const setViewportMeta = () => {
    setMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');
  };

  const setThemeColor = () => {
    setMetaTag('theme-color', '#3B82F6');
    
    // Also set for different color schemes
    const lightTheme = document.createElement('meta');
    lightTheme.name = 'theme-color';
    lightTheme.content = '#3B82F6';
    lightTheme.media = '(prefers-color-scheme: light)';
    document.head.appendChild(lightTheme);
    
    const darkTheme = document.createElement('meta');
    darkTheme.name = 'theme-color';
    darkTheme.content = '#1E40AF';
    darkTheme.media = '(prefers-color-scheme: dark)';
    document.head.appendChild(darkTheme);
  };

  const setPWAMetaTags = () => {
    // Apple specific
    setMetaTag('apple-mobile-web-app-capable', 'yes');
    setMetaTag('apple-mobile-web-app-status-bar-style', 'default');
    setMetaTag('apple-mobile-web-app-title', 'ServiMap');
    
    // Mobile web app
    setMetaTag('mobile-web-app-capable', 'yes');
    setMetaTag('application-name', 'ServiMap');
    
    // Format detection
    setMetaTag('format-detection', 'telephone=no');
    
    // Windows tile
    setMetaTag('msapplication-TileColor', '#3B82F6');
    setMetaTag('msapplication-TileImage', '/icons/icon-144x144.png');
    setMetaTag('msapplication-config', '/browserconfig.xml');
  };

  const setSocialMediaTags = () => {
    // Twitter Card
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:site', '@ServiMapMX');
    setMetaTag('twitter:creator', '@ServiMapMX');
    
    // Additional meta
    setMetaTag('author', 'ServiMap');
    setMetaTag('publisher', 'ServiMap');
    setMetaTag('copyright', 'ServiMap © 2024');
    setMetaTag('language', 'es-MX');
    setMetaTag('geo.region', 'MX');
    setMetaTag('geo.placename', 'México');
  };

  const generateStructuredData = () => {
    const currentPath = window.location.pathname;
    let structuredData = {};
    
    // Organization schema
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "ServiMap",
      "url": "https://servimap.com",
      "logo": "https://servimap.com/icons/icon-512x512.png",
      "description": "Plataforma líder de servicios a domicilio en México",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "MX"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+52-555-123-4567",
        "contactType": "customer service",
        "availableLanguage": ["es", "en"]
      },
      "sameAs": [
        "https://facebook.com/ServiMapMX",
        "https://twitter.com/ServiMapMX",
        "https://instagram.com/ServiMapMX",
        "https://linkedin.com/company/servimap"
      ]
    };
    
    // WebApplication schema
    const webAppSchema = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "ServiMap",
      "url": "https://servimap.com",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "MXN"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "15234"
      }
    };
    
    // Service schema for service pages
    if (currentPath.startsWith('/services/')) {
      structuredData = {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": "Home Services",
        "provider": organizationSchema,
        "areaServed": {
          "@type": "Country",
          "name": "México"
        },
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Servicios a domicilio",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Plomería" }},
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Electricidad" }},
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Carpintería" }}
          ]
        }
      };
    }
    
    // BreadcrumbList schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": generateBreadcrumbs()
    };
    
    // Add all schemas
    addStructuredDataScript(organizationSchema, 'organization-schema');
    addStructuredDataScript(webAppSchema, 'webapp-schema');
    addStructuredDataScript(breadcrumbSchema, 'breadcrumb-schema');
    
    if (Object.keys(structuredData).length > 0) {
      addStructuredDataScript(structuredData, 'page-schema');
    }
  };

  const generateBreadcrumbs = () => {
    const path = window.location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Inicio",
        "item": "https://servimap.com"
      }
    ];
    
    let currentPath = '';
    path.forEach((segment, index) => {
      currentPath += '/' + segment;
      breadcrumbs.push({
        "@type": "ListItem",
        "position": index + 2,
        "name": segment.charAt(0).toUpperCase() + segment.slice(1),
        "item": `https://servimap.com${currentPath}`
      });
    });
    
    return breadcrumbs;
  };

  const addStructuredDataScript = (data, id) => {
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  };

  const optimizeOpenGraph = () => {
    const currentPath = window.location.pathname;
    const baseUrl = 'https://servimap.com';
    
    // Basic OG tags
    setMetaProperty('og:type', 'website');
    setMetaProperty('og:url', baseUrl + currentPath);
    setMetaProperty('og:site_name', 'ServiMap');
    setMetaProperty('og:locale', 'es_MX');
    setMetaProperty('og:locale:alternate', 'en_US');
    
    // Dynamic OG tags based on page
    const ogData = {
      '/': {
        title: 'ServiMap - Servicios a domicilio confiables en México',
        description: 'Encuentra profesionales verificados para todos tus servicios del hogar. Plomería, electricidad, limpieza y más.',
        image: '/images/og-home.jpg'
      },
      '/search': {
        title: 'Buscar Servicios - ServiMap',
        description: 'Busca entre miles de profesionales cerca de ti. Compara precios y contrata con confianza.',
        image: '/images/og-search.jpg'
      },
      '/services': {
        title: 'Todos los Servicios - ServiMap',
        description: 'Más de 50 categorías de servicios a domicilio. Encuentra exactamente lo que necesitas.',
        image: '/images/og-services.jpg'
      }
    };
    
    const pageData = ogData[currentPath] || ogData['/'];
    
    setMetaProperty('og:title', pageData.title);
    setMetaProperty('og:description', pageData.description);
    setMetaProperty('og:image', baseUrl + pageData.image);
    setMetaProperty('og:image:width', '1200');
    setMetaProperty('og:image:height', '630');
    setMetaProperty('og:image:alt', pageData.title);
    
    // Twitter specific
    setMetaTag('twitter:title', pageData.title);
    setMetaTag('twitter:description', pageData.description);
    setMetaTag('twitter:image', baseUrl + pageData.image);
    setMetaTag('twitter:image:alt', pageData.title);
  };

  const setupCanonicalUrls = () => {
    const baseUrl = 'https://servimap.com';
    const currentPath = window.location.pathname;
    
    // Remove existing canonical
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }
    
    // Add new canonical
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = baseUrl + currentPath;
    document.head.appendChild(canonical);
    
    // Add alternate languages
    const languages = [
      { lang: 'es-MX', href: baseUrl + currentPath },
      { lang: 'en-US', href: baseUrl + '/en' + currentPath }
    ];
    
    languages.forEach(({ lang, href }) => {
      const alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = lang;
      alternate.href = href;
      document.head.appendChild(alternate);
    });
  };

  const generateSitemap = () => {
    // This would typically be done server-side
    // Here we just add the sitemap reference
    const sitemap = document.createElement('link');
    sitemap.rel = 'sitemap';
    sitemap.type = 'application/xml';
    sitemap.href = '/sitemap.xml';
    document.head.appendChild(sitemap);
  };

  const optimizeForSearchEngines = () => {
    // Add search action schema
    const searchActionSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://servimap.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://servimap.com/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    };
    
    addStructuredDataScript(searchActionSchema, 'search-action-schema');
    
    // Add FAQ schema for help pages
    if (window.location.pathname.startsWith('/help')) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "¿Cómo funciona ServiMap?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "ServiMap conecta clientes con profesionales verificados. Busca el servicio que necesitas, compara opciones y contrata con seguridad."
            }
          },
          {
            "@type": "Question",
            "name": "¿Es seguro contratar en ServiMap?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Sí, todos nuestros profesionales pasan por un proceso de verificación. Además, ofrecemos pagos seguros y garantía de satisfacción."
            }
          }
        ]
      };
      
      addStructuredDataScript(faqSchema, 'faq-schema');
    }
    
    // Add local business schema for service providers
    if (window.location.pathname.startsWith('/provider/')) {
      const localBusinessSchema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Profesional ServiMap",
        "image": "https://servimap.com/images/provider-default.jpg",
        "priceRange": "$$",
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "MX"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.5",
          "reviewCount": "89"
        }
      };
      
      addStructuredDataScript(localBusinessSchema, 'local-business-schema');
    }
  };

  // Utility functions
  const setMetaTag = (name, content) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  const setMetaProperty = (property, content) => {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  // SEO monitoring component (only in development)
  if (process.env.NODE_ENV === 'development') {
    return <SEOMonitor />;
  }

  return null;
};

// Development SEO monitor
const SEOMonitor = () => {
  const [seoScore, setSeoScore] = useState(0);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    analyzeSEO();
  }, []);

  const analyzeSEO = () => {
    const checks = [
      { name: 'Title tag', pass: document.title.length > 0 && document.title.length < 60 },
      { name: 'Meta description', pass: !!document.querySelector('meta[name="description"]') },
      { name: 'Canonical URL', pass: !!document.querySelector('link[rel="canonical"]') },
      { name: 'Open Graph tags', pass: !!document.querySelector('meta[property^="og:"]') },
      { name: 'Structured data', pass: !!document.querySelector('script[type="application/ld+json"]') },
      { name: 'Mobile viewport', pass: !!document.querySelector('meta[name="viewport"]') },
      { name: 'Theme color', pass: !!document.querySelector('meta[name="theme-color"]') },
      { name: 'Manifest', pass: !!document.querySelector('link[rel="manifest"]') }
    ];

    const passed = checks.filter(check => check.pass).length;
    const score = Math.round((passed / checks.length) * 100);
    
    setSeoScore(score);
    setIssues(checks.filter(check => !check.pass).map(check => check.name));
  };

  return (
    <div className="fixed top-20 right-4 bg-white rounded-lg shadow-xl p-4 max-w-xs z-40">
      <div className="flex items-center space-x-2 mb-3">
        <Search className="w-5 h-5 text-green-500" />
        <h3 className="font-semibold text-gray-900">SEO Score</h3>
        <span className={`ml-auto text-2xl font-bold ${
          seoScore >= 80 ? 'text-green-500' : seoScore >= 60 ? 'text-yellow-500' : 'text-red-500'
        }`}>
          {seoScore}%
        </span>
      </div>
      
      {issues.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="text-gray-600 font-medium">Issues:</p>
          {issues.map((issue, index) => (
            <div key={index} className="text-red-600">• {issue}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SEOOptimizer;