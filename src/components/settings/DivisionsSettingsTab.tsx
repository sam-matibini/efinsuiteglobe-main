import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import Divisions from '@/pages/Divisions';

/**
 * Settings surface for Divisions & Departments.
 * Embeds the existing Divisions manager and provides shortcuts to the
 * standalone page and per-user division access controls.
 */
export function DivisionsSettingsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Divisions &amp; Departments</CardTitle>
          <CardDescription>
            Add, edit, and manage divisions used to tag transactions and produce reports by business unit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/divisions">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open full Divisions page
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/division-access">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Manage user access by division
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Embed the existing manager so no logic is duplicated */}
      <div className="-mx-6 -mb-6 md:mx-0 md:mb-0">
        <Divisions />
      </div>
    </div>
  );
}

export default DivisionsSettingsTab;
