"use client";

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, WifiOff } from 'lucide-react';

export function AvailabilityToggle() {
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {isAvailable ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />}
          Availability Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/30">
          <Switch
            id="availability-mode"
            checked={isAvailable}
            onCheckedChange={setIsAvailable}
            aria-label="Toggle availability"
          />
          <Label htmlFor="availability-mode" className="text-lg font-medium cursor-pointer">
            {isAvailable ? 'You are Online & Available' : 'You are Offline & Unavailable'}
          </Label>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Toggle this switch to control whether clients can see you as available for new service requests.
        </p>
      </CardContent>
    </Card>
  );
}
