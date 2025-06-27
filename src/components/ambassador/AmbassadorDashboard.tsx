// src/components/ambassador/AmbassadorDashboard.tsx
"use client";

import type { AmbassadorData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, DollarSign, Users, Calendar, Handshake } from 'lucide-react';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';

interface AmbassadorDashboardProps {
  data: AmbassadorData | null;
}

export function AmbassadorDashboard({ data }: AmbassadorDashboardProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando Datos del Embajador...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Por favor espera.</p>
        </CardContent>
      </Card>
    );
  }

  const { referidos, gananciasTotales, historialComisiones, codigoPropio } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancias Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${gananciasTotales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Ganancias totales generadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Referidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referidos.length}</div>
            <p className="text-xs text-muted-foreground">Profesionales que has traído a la plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tu Código de Invitación</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-xl font-bold tracking-widest py-1 px-3">{codigoPropio}</Badge>
            <p className="text-xs text-muted-foreground mt-2">Comparte este código con nuevos proveedores</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Handshake /> Tus Proveedores Referidos</CardTitle>
            <CardDescription>Lista de profesionales que se han unido con tu código.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {referidos.length > 0 ? (
                referidos.map((ref) => (
                  <div key={ref.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                    <Avatar>
                      <AvatarImage src={ref.avatarUrl || DEFAULT_USER_AVATAR} alt={ref.name} />
                      <AvatarFallback>{ref.name.substring(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                      <p className="font-medium">{ref.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {ref.id}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no tienes proveedores referidos.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar /> Historial de Comisiones</CardTitle>
            <CardDescription>Detalle de las comisiones ganadas por cada servicio de tus referidos.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialComisiones.length > 0 ? (
                    historialComisiones.map((comision, index) => (
                      <TableRow key={`${comision.servicioId}-${index}`}>
                        <TableCell className="text-xs">
                          {new Date(comision.fecha).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium text-xs">{comision.providerName}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          +${comision.montoComision.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No hay comisiones registradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
