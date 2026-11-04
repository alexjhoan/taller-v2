import NextDocument, { Html, Head, Main, NextScript, DocumentInitialProps, DocumentContext } from "next/document";

class Document extends NextDocument {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const initialProps = await NextDocument.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang='es'>
        <Head>
          <meta charSet='utf-8' />
          <meta name='theme-color' content='#3b82f6' />
          <meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover' />
          <link rel='manifest' href='/manifest.json' />
          <link rel='apple-touch-icon' href='/icons/icon-192x192.png' />
          <meta name='apple-mobile-web-app-capable' content='yes' />
          <meta name='apple-mobile-web-app-status-bar-style' content='default' />
          <meta name='apple-mobile-web-app-title' content='Mecaflow' />
          <meta name='mobile-web-app-capable' content='yes' />
          <meta name='application-name' content='Mecaflow' />
          <meta
            name='description'
            content='Sistema de gestión de taller mecánico - Órdenes, clientes, inventario y más'
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default Document;
