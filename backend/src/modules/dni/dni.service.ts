import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DniResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  direccion?: string;
  sexo?: string;
  fechaNacimiento?: string;
}

export interface RucResponse {
  ruc: string;
  nombre: string;
  estado?: string;
  direccion?: string;
  telefono?: string;
}

@Injectable()
export class DniService {
  private readonly reniecUrl: string;
  private readonly reniecToken: string;
  private readonly sunatUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.reniecUrl = this.configService.get<string>('RENIEC_API_URL') || 'https://api.reniec.cloud/dni';
    this.reniecToken = this.configService.get<string>('RENIEC_API_TOKEN') || '';
    this.sunatUrl = this.configService.get<string>('SUNAT_API_URL') || 'https://api.sunat.cloud/rucs';
  }

  async findByDni(dni: string): Promise<DniResponse> {
    if (!dni || dni.length !== 8 || !/^\d{8}$/.test(dni)) {
      throw new BadRequestException('DNI debe tener 8 dígitos');
    }

    try {
      const headers: Record<string, string> = {};
      if (this.reniecToken) {
        headers['Authorization'] = `Bearer ${this.reniecToken}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.reniecUrl}/${dni}`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException('DNI no encontrado en RENIEC');
        }
        if (response.status === 401) {
          throw new BadRequestException('Error de autenticación con RENIEC');
        }
        throw new BadRequestException(`Error al consultar DNI: ${response.status}`);
      }

      const data = await response.json() as DniResponse;
      
      if (data) {
        return {
          dni: data.dni || dni,
          nombres: data.nombres || '',
          apellidoPaterno: data.apellidoPaterno || '',
          apellidoMaterno: data.apellidoMaterno || '',
          direccion: data.direccion,
          sexo: data.sexo,
          fechaNacimiento: data.fechaNacimiento,
        };
      }

      throw new NotFoundException('DNI no encontrado');
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new BadRequestException('Tiempo de conexión agotado con RENIEC');
        }
        if (error.message.includes('DNI no encontrado')) {
          throw error;
        }
      }
      throw new BadRequestException('Error al consultar DNI');
    }
  }

  async findByRuc(ruc: string): Promise<RucResponse> {
    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      throw new BadRequestException('RUC debe tener 11 dígitos');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.sunatUrl}/${ruc}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException('RUC no encontrado en SUNAT');
        }
        throw new BadRequestException(`Error al consultar RUC: ${response.status}`);
      }

      const data = await response.json() as RucResponse;
      
      if (data) {
        return {
          ruc: data.ruc || ruc,
          nombre: data.nombre || '',
          estado: data.estado,
          direccion: data.direccion,
          telefono: data.telefono,
        };
      }

      throw new NotFoundException('RUC no encontrado');
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new BadRequestException('Tiempo de conexión agotado con SUNAT');
        }
        if (error.message.includes('RUC no encontrado')) {
          throw error;
        }
      }
      throw new BadRequestException('Error al consultar RUC');
    }
  }
}
