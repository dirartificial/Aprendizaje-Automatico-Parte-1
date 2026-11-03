import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { GlossaryModalDS, TERMINOS_GLOSARIO_DS } from '../src/steps/GlossaryModalDS';
import { limpiarProyectoDeIDB } from '../src/core/storageDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 8 — Glosario Pedagógico Modal Interactivo', () => {
  it('contiene más de 15 términos curriculares clasificados en categorías clave', () => {
    expect(TERMINOS_GLOSARIO_DS.length).toBeGreaterThanOrEqual(15);

    const categorias = new Set(TERMINOS_GLOSARIO_DS.map((t) => t.categoria));
    expect(categorias.has('paradigmas')).toBe(true);
    expect(categorias.has('algoritmos')).toBe(true);
    expect(categorias.has('preprocesamiento')).toBe(true);
    expect(categorias.has('metricas')).toBe(true);
    expect(categorias.has('bi')).toBe(true);
  });

  it('no renderiza nada cuando abierto es false', () => {
    render(<GlossaryModalDS abierto={false} onCerrar={vi.fn()} />);
    expect(screen.queryByTestId('glossary-modal')).not.toBeInTheDocument();
  });

  it('renderiza modal accesible con campo de búsqueda y lista de conceptos cuando abierto es true', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    expect(screen.getByTestId('glossary-modal')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-terms-list')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-item-kmeans')).toBeInTheDocument();
  });

  it('filtra los términos en tiempo real según el texto ingresado en el buscador', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const inputBusqueda = screen.getByTestId('glossary-search-input');
    fireEvent.change(inputBusqueda, { target: { value: 'Silueta' } });

    expect(screen.getByText(/Coeficiente de Silueta/)).toBeInTheDocument();
    expect(screen.queryByText(/DBSCAN/)).not.toBeInTheDocument();
  });

  it('filtra los términos al seleccionar una categoría específica', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const btnCatBI = screen.getByTestId('glossary-cat-bi');
    fireEvent.click(btnCatBI);

    expect(screen.getByText(/Función CALCULATE/)).toBeInTheDocument();
    expect(screen.queryByText(/StandardScaler/)).not.toBeInTheDocument();
  });

  it('muestra mensaje amigable cuando no hay resultados para una búsqueda', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const inputBusqueda = screen.getByTestId('glossary-search-input');
    fireEvent.change(inputBusqueda, { target: { value: 'termino_inexistente_xyz' } });

    expect(screen.getByText(/No se encontraron términos/)).toBeInTheDocument();
  });

  it('llama a onCerrar al hacer clic en el botón de cerrar o presionar Escape', () => {
    const onCerrar = vi.fn();
    render(<GlossaryModalDS abierto={true} onCerrar={onCerrar} />);

    const btnCerrar = screen.getByTestId('close-glossary-btn');
    fireEvent.click(btnCerrar);
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});

describe('Fase 8 — Accesibilidad, Modo Oscuro / Claro y App Shell', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
    document.documentElement.removeAttribute('data-theme');
  });

  it('permite alternar entre Modo Oscuro y Modo Claro actualizando data-theme y persistiendo en localStorage', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    const btnTema = screen.getByTestId('toggle-theme-btn');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Cambiar a claro
    fireEvent.click(btnTema);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('ds_tutor_theme')).toBe('light');

    // Cambiar nuevamente a oscuro
    fireEvent.click(btnTema);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('ds_tutor_theme')).toBe('dark');
  });

  it('incluye skip-link accesible para lectores de pantalla hacia el contenido principal', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    const skipLink = screen.getByText('Saltar al contenido principal');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('abre el Glosario interactivo desde la barra superior y permite cerrarlo', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    const btnAbrirGlosario = screen.getByTestId('open-glossary-btn');
    fireEvent.click(btnAbrirGlosario);

    await waitFor(() => {
      expect(screen.getByTestId('glossary-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-glossary-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('glossary-modal')).not.toBeInTheDocument();
    });
  });
});
